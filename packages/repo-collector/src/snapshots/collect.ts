import { Temporal } from "@js-temporal/polyfill"
import type {
  SnapshotData,
  SnapshotMetrics,
} from "@liflig/repo-metrics-repo-collector-types"
import { groupBy } from "lodash-es"
import { CacheProvider } from "../cache"
import { Config } from "../config"
import * as definition from "../definition/definition"
import type { GetReposResponse } from "../definition/types"
import * as github from "../github/service"
import type { GitHubAuthProvider } from "../github/token"
import * as sonarCloud from "../sonarcloud/service"
import type { SonarCloudTokenProvider } from "../sonarcloud/token"
import { GithubDefinitionProvider } from "./definition-provider"
import type { SnapshotsRepository } from "./snapshots-repository"

async function createSnapshotData(
  githubService: github.GitHubService,
  sonarCloudService: sonarCloud.SonarCloudService,
  repos: GetReposResponse[],
  systemsMapping: Map<string, { customer: string; system: string }>,
): Promise<SnapshotData> {
  const reposWithData = repos
    .filter((it) => it.repo.archived !== true)
    .map((it) => ({
      repo: it,
      githubVulnerabilityAlerts: githubService.getVulnerabilityAlerts(
        it.orgName,
        it.repo.name,
      ),
      renovateDependencyDashboardIssue:
        githubService.getRenovateDependencyDashboardIssue(
          it.orgName,
          it.repo.name,
        ),
      sonarCloudMetrics: sonarCloudService.getMetricsByProjectKey(
        `${it.orgName}_${it.repo.name}`,
      ),
    }))

  const pullRequests = groupBy(
    await githubService.getSearchedPullRequestList("capralifecycle"),
    (it) =>
      definition.getRepoId(
        it.baseRepository.owner.login,
        it.baseRepository.name,
      ),
  )

  const result: SnapshotMetrics[] = []

  for (const repo of reposWithData) {
    const repoId = definition.getRepoId(repo.repo.orgName, repo.repo.repo.name)

    const prs = (pullRequests[repoId] ?? []).map((pr) => ({
      number: pr.number,
      author: {
        login: pr.author.login,
      },
      title: pr.title,
      createdAt: pr.createdAt,
      updatedAt: pr.updatedAt,
    }))

    const systemInfo = systemsMapping.get(repo.repo.repo.name)

    result.push({
      version: "1.2",
      repoId,
      responsible: repo.repo.repo.responsible ?? repo.repo.project.responsible,
      customer: systemInfo?.customer,
      system: systemInfo?.system,
      github: {
        orgName: repo.repo.orgName,
        repoName: repo.repo.repo.name,
        prs,
        renovateDependencyDashboardIssue:
          (await repo.renovateDependencyDashboardIssue) ?? null,
        vulnerabilityAlerts: await repo.githubVulnerabilityAlerts,
      },
      sonarCloud: await repo.sonarCloudMetrics,
    })
  }

  const now = Temporal.Now.instant()

  const snapshotData: SnapshotData = {
    timestamp: now.toString(),
    metrics: result,
  }

  return snapshotData
}

/**
 * Produce and store snapshots of the current state which can be used
 * for later analysis.
 */
export async function collect(
  snapshotsRepository: SnapshotsRepository,
  githubTokenProvider?: GitHubAuthProvider,
  sonarCloudTokenProvider?: SonarCloudTokenProvider,
) {
  const config = new Config()
  console.log(`Working directory: ${config.cwd}`)
  console.log(`Cache directory: ${config.cacheDir}`)
  const cache = new CacheProvider(config)
  cache.mustValidate = true
  const githubService = await github.createGitHubService({
    config,
    cache,
    tokenProvider: githubTokenProvider,
  })

  const definitionProvider = new GithubDefinitionProvider(githubService)

  const sonarCloudService = sonarCloud.createSonarCloudService({
    config,
    tokenProvider: sonarCloudTokenProvider,
  })

  const snapshotData = await createSnapshotData(
    githubService,
    sonarCloudService,
    await definitionProvider.getRepos(),
    await definitionProvider.getSystemsMapping(),
  )

  await snapshotsRepository.store(snapshotData)
}

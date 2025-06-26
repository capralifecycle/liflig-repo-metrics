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
import type { GitHubTokenProvider } from "../github/token"
import * as snyk from "../snyk/service"
import type { SnykTokenProvider } from "../snyk/token"
import type { SnykProject } from "../snyk/types"
import * as snykUtil from "../snyk/util"
import * as sonarCloud from "../sonarcloud/service"
import type { SonarCloudTokenProvider } from "../sonarcloud/token"
import { GithubDefinitionProvider } from "./definition-provider"
import type { SnapshotsRepository } from "./snapshots-repository"

/**
 * Queries the various services for the current state of the repositories.
 *
 * @returns A list of repos with supplementary data, sufficient for
 * snapshot storage.
 *
 * @param snykService
 * @param githubService
 * @param sonarCloudService
 * @param repos
 * @param snykAccountId
 */
async function createSnapshotData(
  snykService: snyk.SnykService,
  githubService: github.GitHubService,
  sonarCloudService: sonarCloud.SonarCloudService,
  repos: GetReposResponse[],
  snykAccountId?: string,
): Promise<SnapshotData> {
  const snykData = groupBy(
    snykAccountId != null
      ? await snykService.getProjectsByAccountId(snykAccountId)
      : [],
    (it) => {
      const repo = snykUtil.getGitHubRepo(it)
      return repo ? snykUtil.getGitHubRepoId(repo) : undefined
    },
  )

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
      snykProjects: (
        snykData[definition.getRepoId(it.orgName, it.repo.name)] ?? []
      ).filter((it) => it.isMonitored),
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

    result.push({
      version: "1.2",
      repoId,
      responsible: repo.repo.repo.responsible ?? repo.repo.project.responsible,
      github: {
        orgName: repo.repo.orgName,
        repoName: repo.repo.repo.name,
        prs,
        renovateDependencyDashboardIssue:
          (await repo.renovateDependencyDashboardIssue) ?? null,
        vulnerabilityAlerts: await repo.githubVulnerabilityAlerts,
      },
      snyk: {
        projects: repo.snykProjects as unknown as SnykProject[],
      },
      sonarCloud: await repo.sonarCloudMetrics,
    })
  }

  const now = Temporal.Now.instant()

  // noinspection UnnecessaryLocalVariableJS
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
  githubTokenProvider?: GitHubTokenProvider,
  snykTokenProvider?: SnykTokenProvider,
  sonarCloudTokenProvider?: SonarCloudTokenProvider,
) {
  const config = new Config()
  const cache = new CacheProvider(config)
  cache.mustValidate = true
  const githubService = await github.createGitHubService({
    config,
    cache,
    tokenProvider: githubTokenProvider,
  })

  const definitionProvider = new GithubDefinitionProvider(githubService)
  const snykService = snyk.createSnykService({
    config,
    tokenProvider: snykTokenProvider,
  })

  const sonarCloudService = sonarCloud.createSonarCloudService({
    config,
    tokenProvider: sonarCloudTokenProvider,
  })

  const snapshotData = await createSnapshotData(
    snykService,
    githubService,
    sonarCloudService,
    await definitionProvider.getRepos(),
    await definitionProvider.getSnykAccountId(),
  )

  await snapshotsRepository.store(snapshotData)
}

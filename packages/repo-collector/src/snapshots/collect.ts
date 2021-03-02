import {
  CacheProvider,
  Config,
  definition,
  github,
  snyk,
} from "@capraconsulting/cals-cli"
import { GitHubTokenProvider } from "@capraconsulting/cals-cli/lib/github/token"
import { SnykTokenProvider } from "@capraconsulting/cals-cli/lib/snyk/token"
import { MetricRepoSnapshot } from "@liflig/repo-metrics-repo-collector-types"
import { groupBy } from "lodash"
import { GithubDefinitionProvider } from "./definition-provider"
import { SnapshotsRepository } from "./snapshots-repository"

interface SnykProject extends snyk.SnykProject {
  // Not documented in https://snyk.docs.apiary.io/#reference/projects/all-projects/list-all-projects
  browseUrl: string
}

async function createSnapshots(
  timestamp: Date,
  snykService: snyk.SnykService,
  githubService: github.GitHubService,
  repos: definition.GetReposResponse[],
  snykAccountId?: string,
): Promise<MetricRepoSnapshot[]> {
  const snykData = groupBy(
    snykAccountId != null
      ? await snykService.getProjectsByAccountId(snykAccountId)
      : [],
    (it) => {
      const repo = snyk.getGitHubRepo(it)
      return repo ? snyk.getGitHubRepoId(repo) : undefined
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
      renovateDependencyDashboardIssue: githubService.getRenovateDependencyDashboardIssue(
        it.orgName,
        it.repo.name,
      ),
      snykProjects: (
        snykData[definition.getRepoId(it.orgName, it.repo.name)] ?? []
      ).filter((it) => it.isMonitored),
    }))

  const pullRequests = groupBy(
    await githubService.getSearchedPullRequestList(),
    (it) =>
      definition.getRepoId(
        it.baseRepository.owner.login,
        it.baseRepository.name,
      ),
  )

  const result: MetricRepoSnapshot[] = []

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
      version: "1",
      timestamp: timestamp.toISOString(),
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
        projects: (repo.snykProjects as unknown) as SnykProject[],
      },
    })
  }

  return result
}

/**
 * Produce and store snapshots of the current state which can be used
 * for later analysis.
 */
export async function collect(
  snapshotsRepository: SnapshotsRepository,
  githubTokenProvider?: GitHubTokenProvider,
  snykTokenProvider?: SnykTokenProvider,
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
  /*
  const definitionProvider = new LocalDefinitionProvider(
    "../../../../../capraconsulting/misc/resources-definition/resources.yaml",
    "../../../resources-definition/resources.yaml",
  )
  */

  const snykService = snyk.createSnykService({
    config,
    tokenProvider: snykTokenProvider,
  })

  const timestamp = new Date()

  const snapshots = await createSnapshots(
    timestamp,
    snykService,
    githubService,
    await definitionProvider.getRepos(),
    await definitionProvider.getSnykAccountId(),
  )

  await snapshotsRepository.store(timestamp, snapshots)
}

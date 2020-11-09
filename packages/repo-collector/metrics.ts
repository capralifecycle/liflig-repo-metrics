import {
  CacheProvider,
  Config,
  definition,
  github,
  snyk,
} from "@capraconsulting/cals-cli"
import { MetricRepoSnapshot } from "@liflig/repo-metrics-repo-collector-types"
import * as fs from "fs"
import { groupBy } from "lodash"

async function createSnapshots(
  snykService: snyk.SnykService,
  githubService: github.GitHubService,
  definitionData: definition.Definition,
): Promise<MetricRepoSnapshot[]> {
  const timestamp = new Date().toISOString()

  const snykData = groupBy(
    await snykService.getProjects(definitionData),
    (it) => {
      const repo = snyk.getGitHubRepo(it)
      return repo ? snyk.getGitHubRepoId(repo) : undefined
    },
  )

  const repos = definition
    .getRepos(definitionData)
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
      snykProjects:
        snykData[definition.getRepoId(it.orgName, it.repo.name)] ?? [],
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

  for (const repo of repos) {
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
      timestamp,
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
        projects: repo.snykProjects,
      },
    })
  }

  return result
}

async function main() {
  const config = new Config()
  const cache = new CacheProvider(config)
  cache.mustValidate = true
  const githubService = await github.createGitHubService(config, cache)

  // TODO: Make customizable.
  const definitionFile = new definition.DefinitionFile(
    "../../../../resources-definition/resources.yaml",
  )

  const snykService = snyk.createSnykService(config)

  const definitionData = await definitionFile.getDefinition()

  const snapshots = await createSnapshots(
    snykService,
    githubService,
    definitionData,
  )

  // TODO: Merge with old data. Should we partition the data?

  fs.writeFileSync(
    "result.json",
    JSON.stringify(snapshots, undefined, "  "),
    "utf-8",
  )
}

main().catch((error) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  console.error(error.stack || error.message || error)
  process.exitCode = 1
})

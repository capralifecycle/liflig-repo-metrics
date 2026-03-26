import yaml from "js-yaml"
import * as definition from "../definition/definition"
import type {
  RepoSystemMapping,
  SystemsDefinition,
} from "../definition/systems-types"
import type { Definition, GetReposResponse } from "../definition/types"
import type { GitHubService } from "../github/service"

export interface DefinitionProvider {
  getRepos(): Promise<GetReposResponse[]>
  getSnykAccountId(): Promise<string | undefined>
  getSystemsMapping(): Promise<Map<string, RepoSystemMapping>>
}

interface DefinitionData {
  data: Definition
  filterByTag: string | null
}

function getRepos(definitions: DefinitionData[]): GetReposResponse[] {
  const result: GetReposResponse[] = []

  for (const def of definitions) {
    const repos = definition
      .getRepos(def.data)
      .filter(
        (it) =>
          def.filterByTag == null ||
          (it.project.tags ?? []).includes(def.filterByTag),
      )

    result.push(...repos)
  }

  return result
}

function getSnykAccountId(definitions: DefinitionData[]): string | undefined {
  for (const def of definitions) {
    const snykAccountId = def.data.snyk?.accountId
    if (snykAccountId != null) {
      return snykAccountId
    }
  }
  return undefined
}

export class GithubDefinitionProvider implements DefinitionProvider {
  private githubService: GitHubService

  private definitionDataList: DefinitionData[] | undefined
  private systemsMappingCache: Map<string, RepoSystemMapping> | undefined

  constructor(githubService: GitHubService) {
    this.githubService = githubService
  }

  private async getDefinition(request: {
    owner: string
    path: string
    repo: string
  }): Promise<Definition> {
    const result = await this.githubService.octokit.repos.getContent({
      owner: request.owner,
      path: request.path,
      repo: request.repo,
    })

    if (!("content" in result.data)) {
      throw new Error("Unexpected response from getContent - content not found")
    }

    const content = Buffer.from(result.data.content, "base64").toString("utf-8")
    return definition.parseDefinition(content)
  }

  private async getDefinitions(): Promise<DefinitionData[]> {
    if (!this.definitionDataList) {
      this.definitionDataList = []

      this.definitionDataList.push({
        data: await this.getDefinition({
          owner: "capralifecycle",
          path: "resources.yaml",
          repo: "resources-definition",
        }),
        filterByTag: null,
      })
    }

    return this.definitionDataList
  }

  async getRepos(): Promise<GetReposResponse[]> {
    return getRepos(await this.getDefinitions())
  }

  async getSnykAccountId(): Promise<string | undefined> {
    return getSnykAccountId(await this.getDefinitions())
  }

  async getSystemsMapping(): Promise<Map<string, RepoSystemMapping>> {
    if (this.systemsMappingCache) {
      return this.systemsMappingCache
    }

    const result = await this.githubService.octokit.repos.getContent({
      owner: "capralifecycle",
      repo: "resources-definition",
      path: "systems.yaml",
    })

    if (!("content" in result.data)) {
      throw new Error("Unexpected response from getContent - content not found")
    }

    const content = Buffer.from(result.data.content, "base64").toString("utf-8")
    const parsed = yaml.load(content) as SystemsDefinition

    const mapping = new Map<string, RepoSystemMapping>()
    for (const customer of parsed.customers) {
      for (const system of customer.systems) {
        for (const repo of system.repos) {
          mapping.set(repo, { customer: customer.name, system: system.name })
        }
      }
    }

    this.systemsMappingCache = mapping
    return mapping
  }
}

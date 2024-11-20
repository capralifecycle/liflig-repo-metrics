import type { github } from "@capraconsulting/cals-cli"
import { definition } from "@capraconsulting/cals-cli"

export interface DefinitionProvider {
  getRepos(): Promise<definition.GetReposResponse[]>
  getSnykAccountId(): Promise<string | undefined>
}

interface DefinitionData {
  data: definition.Definition
  filterByTag: string | null
}

function getRepos(
  definitions: DefinitionData[],
): definition.GetReposResponse[] {
  const result: definition.GetReposResponse[] = []

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

export class LocalDefinitionProvider implements DefinitionProvider {
  private capraDefinitionFile: string
  private lifligDefinitionFile: string

  private definitionDataList: DefinitionData[] | undefined

  constructor(capraDefinitionFile: string, lifligDefinitionFile: string) {
    this.capraDefinitionFile = capraDefinitionFile
    this.lifligDefinitionFile = lifligDefinitionFile
  }

  private async getDefinitions(): Promise<DefinitionData[]> {
    if (!this.definitionDataList) {
      this.definitionDataList = []

      this.definitionDataList.push({
        data: await new definition.DefinitionFile(
          this.lifligDefinitionFile,
        ).getDefinition(),
        filterByTag: null,
      })

      this.definitionDataList.push({
        data: await new definition.DefinitionFile(
          this.capraDefinitionFile,
        ).getDefinition(),
        filterByTag: "liflig",
      })
    }

    return this.definitionDataList
  }

  async getRepos(): Promise<definition.GetReposResponse[]> {
    return getRepos(await this.getDefinitions())
  }
  async getSnykAccountId(): Promise<string | undefined> {
    return getSnykAccountId(await this.getDefinitions())
  }
}

export class GithubDefinitionProvider implements DefinitionProvider {
  private githubService: github.GitHubService

  private definitionDataList: DefinitionData[] | undefined

  constructor(githubService: github.GitHubService) {
    this.githubService = githubService
  }

  private async getDefinition(request: {
    owner: string
    path: string
    repo: string
  }): Promise<definition.Definition> {
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

  async getRepos(): Promise<definition.GetReposResponse[]> {
    return getRepos(await this.getDefinitions())
  }
  async getSnykAccountId(): Promise<string | undefined> {
    return getSnykAccountId(await this.getDefinitions())
  }
}

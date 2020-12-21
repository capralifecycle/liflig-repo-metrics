import { definition, github } from "@capraconsulting/cals-cli"

export interface DefinitionProvider {
  getDefinition(): Promise<definition.Definition>
}

export class LocalDefinitionProvider implements DefinitionProvider {
  private definitionFile: string

  constructor(definitionFile: string) {
    this.definitionFile = definitionFile
  }

  async getDefinition(): Promise<definition.Definition> {
    const definitionFile = new definition.DefinitionFile(this.definitionFile)
    return await definitionFile.getDefinition()
  }
}

export class GithubDefinitionProvider implements DefinitionProvider {
  private githubService: github.GitHubService

  constructor(githubService: github.GitHubService) {
    this.githubService = githubService
  }

  async getDefinition(): Promise<definition.Definition> {
    const result = await this.githubService.octokit.repos.getContent({
      owner: "capralifecycle",
      path: "resources.yaml",
      repo: "resources-definition",
    })

    const content = Buffer.from(result.data.content, "base64").toString("utf-8")
    return await definition.parseDefinition(content)
  }
}

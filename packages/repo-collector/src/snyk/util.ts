import type { SnykGitHubRepo, SnykProject } from "./types"

export function getGitHubRepo(
  snykProject: SnykProject,
): SnykGitHubRepo | undefined {
  if (snykProject.origin === "github") {
    const match = /^([^/]+)\/([^:]+)(:(.+))?$/.exec(snykProject.name)
    if (match === null) {
      throw Error(
        `Could not extract components from Snyk project name: ${snykProject.name} (id: ${snykProject.id})`,
      )
    }

    return {
      owner: match[1],
      name: match[2],
    }
  } else if (
    snykProject.origin === "cli" &&
    snykProject.remoteRepoUrl != null
  ) {
    const match = /github.com\/([^/]+)\/(.+)\.git$/.exec(
      snykProject.remoteRepoUrl,
    )
    if (match === null) {
      return undefined
    }

    return {
      owner: match[1],
      name: match[2],
    }
  } else {
    return undefined
  }
}

export function getGitHubRepoId(
  repo: SnykGitHubRepo | undefined,
): string | undefined {
  return repo ? `${repo.owner}/${repo.name}` : undefined
}
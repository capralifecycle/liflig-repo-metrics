import { Octokit } from "@octokit/rest"
import type { OctokitResponse } from "@octokit/types"
import fetch from "node-fetch"
import type { LimitFunction } from "p-limit"
import pLimit from "p-limit"
import type { CacheProvider } from "../cache"
import type { Config } from "../config"
import type { GitHubTokenProvider } from "./token"
import { GitHubTokenCliProvider } from "./token"
import type {
  RenovateDependencyDashboardIssue,
  VulnerabilityAlert,
} from "./types"
import * as process from "process"
import { performance } from "perf_hooks"

interface SearchedPullRequestListQueryResult {
  search: {
    pageInfo: {
      hasNextPage: boolean
      endCursor: string | null
    }
    edges: {
      node: {
        __typename: string
        number: number
        baseRepository: {
          name: string
          owner: {
            login: string
          }
          defaultBranchRef: {
            name: string
          }
        }
        author: {
          login: string
        }
        title: string
        commits: {
          nodes: {
            commit: {
              messageHeadline: string
            }
          }[]
        }
        createdAt: string
        updatedAt: string
      }
    }[]
  }
}

export type SearchedPullRequestListItem =
  SearchedPullRequestListQueryResult["search"]["edges"][0]["node"]

interface RenovateDependencyDashboardIssueQueryResult {
  repository: {
    issues: {
      pageInfo: {
        hasNextPage: boolean
        endCursor: string | null
      }
      edges: {
        node: {
          __typename: string
          number: number
          state: string
          title: string
          body: string
          userContentEdits: {
            nodes:
              | {
                  createdAt: string
                  editor: {
                    login: string
                  } | null
                }[]
              | null
          } | null
        }
      }[]
    }
  }
}

interface VulnerabilityAlertsQueryResult {
  repository: {
    vulnerabilityAlerts: {
      pageInfo: {
        hasNextPage: boolean
        endCursor: string | null
      }
      edges: Array<{
        node: VulnerabilityAlert
      }> | null
    }
  } | null
}

interface EtagCacheItem<T> {
  etag: string
  data: T
}

interface GitHubServiceProps {
  config: Config
  octokit: Octokit
  cache: CacheProvider
  tokenProvider: GitHubTokenProvider
}

export class GitHubService {
  private config: Config
  public octokit: Octokit
  private cache: CacheProvider
  private tokenProvider: GitHubTokenProvider
  private readonly semaphore: LimitFunction

  public constructor(props: GitHubServiceProps) {
    this.config = props.config
    this.octokit = props.octokit
    this.cache = props.cache
    this.tokenProvider = props.tokenProvider

    // Control concurrency to GitHub API at service level so we
    // can maximize concurrency all other places.
    this.semaphore = pLimit(6)

    this.octokit.hook.wrap("request", async (request, options) => {
      if (options.method !== "GET") {
        return this.semaphore(() => request(options))
      }

      // Try to cache ETag for GET requests to save on rate limiting.
      // Hits on ETag does not count towards rate limiting.

      const rest = {
        ...options,
      } as any
      delete rest.method
      delete rest.baseUrl
      delete rest.headers
      delete rest.mediaType
      delete rest.request

      // Build a key that is used to identify this request.
      const key = Buffer.from(JSON.stringify(rest)).toString("base64")

      const cacheItem =
        this.cache.retrieveJson<EtagCacheItem<ReturnType<typeof request>>>(key)

      if (cacheItem !== undefined) {
        // Copying doesn't work, seems we need to mutate this.
        options.headers["If-None-Match"] = cacheItem.data.etag
      }

      const getResponse = async (
        allowRetry = true,
      ): Promise<OctokitResponse<unknown> | undefined> => {
        try {
          return await request(options)
        } catch (e) {
          // Handle no change in ETag.
          if (e.status === 304) {
            return undefined
          }
          // GitHub seems to throw a lot of 502 errors.
          // Let's give it a few seconds and retry one time.
          if (e.status === 502 && allowRetry) {
            await new Promise((resolve) => setTimeout(resolve, 2000))
            return await getResponse(false)
          }
          throw e
        }
      }

      const response = await this.semaphore(async () => {
        return getResponse()
      })

      if (response === undefined) {
        // Undefined is returned for cached data.

        if (cacheItem === undefined) {
          throw new Error("Missing expected cache item")
        }

        // Use previous value.
        return cacheItem.data.data
      }

      // New value. Store Etag.
      if (response.headers.etag) {
        this.cache.storeJson<EtagCacheItem<unknown>>(key, {
          etag: response.headers.etag,
          data: response,
        })
      }

      return response
    })
  }

  public async runGraphqlQuery<T>(query: string): Promise<T> {
    const token = await this.tokenProvider.getToken()
    if (token === undefined) {
      throw new Error("Missing token for GitHub")
    }

    const url = "https://api.github.com/graphql"
    const headers = {
      Authorization: `Bearer ${token}`,
    }

    let requestDuration = -1
    const response = await this.semaphore(() => {
      const requestStart = performance.now()
      const result = fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ query }),
        agent: this.config.agent,
      })
      requestDuration = performance.now() - requestStart
      return result
    })

    if (response.status === 401) {
      process.stderr.write("Unauthorized\n")
      await this.tokenProvider.markInvalid()
    }

    // If you get 502 after 10s, it is a timeout.
    if (response.status === 502) {
      throw new Error(
        `Response from Github likely timed out (10s max) after elapsed ${requestDuration}ms with status ${
          response.status
        }: ${await response.text()}`,
      )
    }

    if (!response.ok) {
      throw new Error(
        `Response from GitHub not OK (${
          response.status
        }): ${await response.text()}`,
      )
    }

    const json = (await response.json()) as {
      data?: T | null

      errors?: any
    }

    if (json.errors) {
      throw new Error(
        `Error from GitHub GraphQL API: ${JSON.stringify(json.errors)}`,
      )
    }

    if (json.data == null) {
      throw new Error(
        `No data received from GitHub GraphQL API (unknown reason)`,
      )
    }

    return json.data
  }

  public async getSearchedPullRequestList(
    owner: string,
  ): Promise<SearchedPullRequestListItem[]> {
    // NOTE: Changes to this must be synced with SearchedPullRequestListQueryResult.
    const getQuery = (after: string | null) => `{
  search(
    query: "is:open is:pr user:${owner} owner:${owner} archived:false",
    type: ISSUE,
    first: 50${
      after === null
        ? ""
        : `,
    after: "${after}"`
    }
  ) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      node {
        __typename
        ... on PullRequest {
          number
          baseRepository {
            name
            owner {
              login
            }
            defaultBranchRef {
              name
            }
          }
          author {
            login
          }
          title
          commits(first: 3) {
            nodes {
              commit {
                messageHeadline
              }
            }
          }
          createdAt
          updatedAt
        }
      }
    }
  }
}`

    const pulls: SearchedPullRequestListItem[] = []
    let after = null

    while (true) {
      const query = getQuery(after)
      const res =
        await this.runGraphqlQuery<SearchedPullRequestListQueryResult>(query)

      pulls.push(...res.search.edges.map((it) => it.node))

      if (!res.search.pageInfo.hasNextPage) {
        break
      }

      after = res.search.pageInfo.endCursor
    }

    return pulls.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  /**
   * Get the vulnerability alerts for a repository.
   */
  public async getVulnerabilityAlerts(
    owner: string,
    repo: string,
  ): Promise<VulnerabilityAlert[]> {
    // NOTE: Changes to this must be synced with VulnerabilityAlertsQueryResult.
    const getQuery = (after: string | null) => `{
  repository(owner: "${owner}", name: "${repo}") {
    vulnerabilityAlerts(first: 100${
      after === null ? "" : `, after: "${after}"`
    }) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          state
          dismissReason
          vulnerableManifestFilename
          vulnerableManifestPath
          vulnerableRequirements
          securityAdvisory {
            description
            identifiers { type value }
            references { url }
            severity
          }
          securityVulnerability {
            package { name ecosystem }
            firstPatchedVersion { identifier }
            vulnerableVersionRange
          }
        }
      }
    }
  }
}`

    return this.cache.json(
      `vulnerability-alerts-${owner}-${repo}`,
      async () => {
        const result: VulnerabilityAlert[] = []
        let after = null

        while (true) {
          const query = getQuery(after)
          const res =
            await this.runGraphqlQuery<VulnerabilityAlertsQueryResult>(query)

          result.push(
            ...(res.repository?.vulnerabilityAlerts.edges?.map(
              (it) => it.node,
            ) ?? []),
          )

          if (!res.repository?.vulnerabilityAlerts.pageInfo.hasNextPage) {
            break
          }

          after = res.repository?.vulnerabilityAlerts.pageInfo.endCursor
        }

        return result
      },
    )
  }

  /**
   * Get the Renovate Dependency Dashboard issue.
   */
  public async getRenovateDependencyDashboardIssue(
    owner: string,
    repo: string,
  ): Promise<RenovateDependencyDashboardIssue | undefined> {
    // NOTE: Changes to this must be synced with RenovateDependencyDashboardIssueQueryResult.
    const getQuery = (after: string | null) => `{
  repository(owner: "${owner}", name: "${repo}") {
    issues(
      orderBy: {field: UPDATED_AT, direction: DESC},
      filterBy: {createdBy: "renovate[bot]"},
      states: [OPEN],
      first: 100${after === null ? "" : `, after: "${after}"`}
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          number
          state
          title
          body
          userContentEdits(first: 5) {
            nodes {
              createdAt
              editor {
                login
              }
            }
          }
        }
      }
    }
  }
}`

    const issues = await this.cache.json(
      `renovate-bot-issues-${owner}-${repo}`,
      async () => {
        const result: RenovateDependencyDashboardIssue[] = []
        let after = null

        while (true) {
          const query = getQuery(after)
          const res =
            await this.runGraphqlQuery<RenovateDependencyDashboardIssueQueryResult>(
              query,
            )

          const nodes = res.repository?.issues.edges?.map((it) => it.node) ?? []

          result.push(
            ...nodes
              .filter((it) => it.title === "Dependency Dashboard")
              .map((it) => ({
                number: it.number,
                body: it.body,
                lastUpdatedByRenovate:
                  it.userContentEdits?.nodes?.filter(
                    (it) => it.editor?.login === "renovate",
                  )?.[0]?.createdAt ?? null,
              })),
          )

          if (!res.repository?.issues.pageInfo.hasNextPage) {
            break
          }

          after = res.repository?.issues.pageInfo.endCursor
        }

        return result
      },
    )

    if (issues.length == 0) {
      return undefined
    }

    return issues[0]
  }
}

async function createOctokit(
  config: Config,
  tokenProvider: GitHubTokenProvider,
) {
  return new Octokit({
    auth: await tokenProvider.getToken(),
    request: {
      agent: config.agent,
    },
  })
}

interface CreateGitHubServiceProps {
  config: Config
  cache: CacheProvider
  tokenProvider?: GitHubTokenProvider
}

export async function createGitHubService(
  props: CreateGitHubServiceProps,
): Promise<GitHubService> {
  const tokenProvider = props.tokenProvider ?? new GitHubTokenCliProvider()

  return new GitHubService({
    config: props.config,
    octokit: await createOctokit(props.config, tokenProvider),
    cache: props.cache,
    tokenProvider,
  })
}

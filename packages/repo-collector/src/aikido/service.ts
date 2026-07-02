import type { Agent } from "node:https"
import type {
  AikidoIssueGroup,
  AikidoMetrics,
  AikidoSeverity,
} from "@liflig/repo-metrics-repo-collector-types"
import type { Config } from "../config"
import type { AikidoCredentials, AikidoCredentialsProvider } from "./token"
import { AikidoCredentialsCliProvider } from "./token"

type FetchOptions = RequestInit & { agent: Agent }

const AIKIDO_BASE_URL = "https://app.aikido.dev"
const TOKEN_URL = `${AIKIDO_BASE_URL}/api/oauth/token`
const API_BASE = `${AIKIDO_BASE_URL}/api/public/v1`

const REPOS_PER_PAGE = 200
const ISSUES_PER_PAGE = 5000
const MAX_RETRIES = 5

/**
 * Issue types counted as "vulnerabilities". Excludes `license` (compliance, not
 * a security finding). Single source of truth for the collection scope.
 */
export const ISSUE_TYPES = new Set([
  "open_source",
  "sast",
  "leaked_secret",
  "iac",
  "cloud",
  "malware",
  "eol",
])

const SEVERITY_RANK: Record<AikidoSeverity, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
}

interface AikidoCodeRepo {
  id: number
  name: string
  provider: string
  external_repo_id: string
  url: string
}

interface AikidoIssue {
  id: number
  group_id: number
  severity: AikidoSeverity
  type: string
  code_repo_id: number
  code_repo_name: string
  cve_id: string | null
  affected_package: string | null
  /** Name of the rule that produced the finding, e.g. "SQL injection". */
  rule: string | null
}

type IssueStatus = "open" | "ignored" | "snoozed" | "closed"

interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface AikidoServiceProps {
  config: Config
  credentialsProvider: AikidoCredentialsProvider
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class AikidoService {
  private config: Config
  private credentialsProvider: AikidoCredentialsProvider
  private accessToken: string | null = null

  public constructor(props: AikidoServiceProps) {
    this.config = props.config
    this.credentialsProvider = props.credentialsProvider
  }

  private async getAccessToken(forceRefresh = false): Promise<string> {
    if (this.accessToken && !forceRefresh) {
      return this.accessToken
    }

    const { clientId, clientSecret }: AikidoCredentials =
      await this.credentialsProvider.getCredentials()
    const basic = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString(
      "base64",
    )

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: "grant_type=client_credentials",
      agent: this.config.agent,
    } as FetchOptions)

    if (!response.ok) {
      throw new Error(
        `Aikido token exchange failed (${response.status}): ${await response.text()}`,
      )
    }

    const token = (await response.json()) as TokenResponse
    this.accessToken = token.access_token
    return this.accessToken
  }

  /**
   * GET an Aikido API path. Honors the 20 req/min rate limit by respecting the
   * `Retry-After` header on 429 (with exponential-backoff fallback), and
   * re-authenticates once on 401.
   */
  private async apiGet<T>(path: string): Promise<T> {
    let reauthed = false

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const token = await this.getAccessToken()
      const response = await fetch(`${API_BASE}${path}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        agent: this.config.agent,
      } as FetchOptions)

      if (response.status === 401 && !reauthed) {
        reauthed = true
        await this.getAccessToken(true)
        continue
      }

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after"))
        const waitSeconds = Number.isFinite(retryAfter)
          ? retryAfter
          : 2 ** attempt
        process.stderr.write(
          `Aikido rate limited on ${path}, waiting ${waitSeconds}s\n`,
        )
        await sleep(waitSeconds * 1000)
        continue
      }

      if (!response.ok) {
        throw new Error(
          `Response from Aikido not OK (${response.status}) for ${path}: ${await response.text()}`,
        )
      }

      return (await response.json()) as T
    }

    throw new Error(`Aikido request to ${path} exhausted retries`)
  }

  private async listCodeRepos(): Promise<AikidoCodeRepo[]> {
    const repos: AikidoCodeRepo[] = []
    for (let page = 0; ; page++) {
      const batch = await this.apiGet<AikidoCodeRepo[]>(
        `/repositories/code?page=${page}&per_page=${REPOS_PER_PAGE}&include_inactive=false`,
      )
      repos.push(...batch)
      if (batch.length < REPOS_PER_PAGE) break
    }
    return repos
  }

  private async exportIssues(status: IssueStatus): Promise<AikidoIssue[]> {
    const issues: AikidoIssue[] = []
    for (let page = 0; ; page++) {
      const batch = await this.apiGet<AikidoIssue[]>(
        `/issues/export?format=json&filter_status=${status}&page=${page}&per_page=${ISSUES_PER_PAGE}`,
      )
      issues.push(...batch)
      if (batch.length < ISSUES_PER_PAGE) break
    }
    return issues
  }

  /**
   * Fetch all onboarded repos, their open issues, and their ignored issues,
   * then aggregate into per-repo metrics. Issues are filtered to
   * security-relevant `ISSUE_TYPES` and deduplicated by `group_id` (keeping the
   * highest severity).
   *
   * Returns a map keyed by lowercased repo name (both the Aikido repo name and
   * the repo slug from its URL, so lookups by GitHub repo name resolve).
   */
  public async getIssueGroupsByRepo(): Promise<Map<string, AikidoMetrics>> {
    const [repos, openIssues, ignoredIssues] = await Promise.all([
      this.listCodeRepos(),
      this.exportIssues("open"),
      this.exportIssues("ignored"),
    ])

    const groupsByRepoId = groupIssuesByRepo(openIssues)
    const ignoredByRepoId = countGroupsByRepo(ignoredIssues)

    const byName = new Map<string, AikidoMetrics>()
    for (const repo of repos) {
      const metrics: AikidoMetrics = {
        enabled: true,
        issueGroups: groupsByRepoId.get(repo.id) ?? [],
        ignoredCount: ignoredByRepoId.get(repo.id) ?? 0,
      }
      for (const key of repoLookupKeys(repo)) {
        byName.set(key, metrics)
      }
    }
    return byName
  }
}

/** Candidate lookup keys for an Aikido repo: its name and its URL repo slug. */
function repoLookupKeys(repo: AikidoCodeRepo): string[] {
  const keys = [repo.name.toLowerCase()]
  const slug = repo.url.split("/").filter(Boolean).pop()
  if (slug) keys.push(slug.toLowerCase())
  return keys
}

interface GroupAccumulator {
  groupId: number
  issueId: number
  severity: AikidoSeverity
  type: string
  count: number
  affectedPackage: string | null
  rule: string | null
  cveId: string | null
}

function groupIssuesByRepo(
  issues: AikidoIssue[],
): Map<number, AikidoIssueGroup[]> {
  // repoId -> groupId -> accumulator (highest severity wins, count tracked).
  const perRepo = new Map<number, Map<number, GroupAccumulator>>()

  for (const issue of issues) {
    if (!ISSUE_TYPES.has(issue.type)) continue

    let groups = perRepo.get(issue.code_repo_id)
    if (!groups) {
      groups = new Map()
      perRepo.set(issue.code_repo_id, groups)
    }

    const existing = groups.get(issue.group_id)
    if (!existing) {
      groups.set(issue.group_id, {
        groupId: issue.group_id,
        issueId: issue.id,
        severity: issue.severity,
        type: issue.type,
        count: 1,
        affectedPackage: issue.affected_package,
        rule: issue.rule,
        cveId: issue.cve_id,
      })
    } else {
      existing.count += 1
      if (SEVERITY_RANK[issue.severity] > SEVERITY_RANK[existing.severity]) {
        existing.severity = issue.severity
        existing.issueId = issue.id
      }
    }
  }

  const result = new Map<number, AikidoIssueGroup[]>()
  for (const [repoId, groups] of perRepo) {
    result.set(
      repoId,
      [...groups.values()].map((g) => ({
        groupId: g.groupId,
        issueId: g.issueId,
        severity: g.severity,
        type: g.type,
        title: deriveTitle(g),
      })),
    )
  }
  return result
}

// Aikido's human-readable title. Secrets are aggregated ("N exposed secrets");
// dependency vulns show the package, SAST/IaC/etc. show the rule name.
function deriveTitle(g: GroupAccumulator): string {
  if (g.type === "leaked_secret") {
    return g.count > 1 ? `${g.count} exposed secrets` : "Exposed secret"
  }
  return g.affectedPackage ?? g.rule ?? g.cveId ?? g.type
}

// Counts distinct issue groups per repo (used for the ignored-issue count).
function countGroupsByRepo(issues: AikidoIssue[]): Map<number, number> {
  const perRepo = new Map<number, Set<number>>()
  for (const issue of issues) {
    if (!ISSUE_TYPES.has(issue.type)) continue
    let groups = perRepo.get(issue.code_repo_id)
    if (!groups) {
      groups = new Set()
      perRepo.set(issue.code_repo_id, groups)
    }
    groups.add(issue.group_id)
  }
  const result = new Map<number, number>()
  for (const [repoId, groups] of perRepo) result.set(repoId, groups.size)
  return result
}

interface CreateAikidoServiceProps {
  config: Config
  credentialsProvider?: AikidoCredentialsProvider
}

export function createAikidoService(
  props: CreateAikidoServiceProps,
): AikidoService {
  return new AikidoService({
    config: props.config,
    credentialsProvider:
      props.credentialsProvider ?? new AikidoCredentialsCliProvider(),
  })
}

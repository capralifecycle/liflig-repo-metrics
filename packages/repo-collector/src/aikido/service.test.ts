import { afterEach, describe, expect, test, vi } from "vitest"
import { Config } from "../config"
import { AikidoService } from "./service"

const credentialsProvider = {
  getCredentials: async () => ({
    clientId: "id",
    clientSecret: "secret",
  }),
}

function service(): AikidoService {
  return new AikidoService({
    config: new Config(),
    credentialsProvider,
  })
}

interface FakeResponseInit {
  status?: number
  headers?: Record<string, string>
}

function jsonResponse(body: unknown, init: FakeResponseInit = {}) {
  const status = init.status ?? 200
  const headers = new Map(
    Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
  )
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

const REPOS = [
  {
    id: 1,
    name: "repo-a",
    provider: "github",
    external_repo_id: "R_a",
    url: "https://github.com/capralifecycle/repo-a",
  },
  {
    id: 2,
    name: "repo-b",
    provider: "github",
    external_repo_id: "R_b",
    url: "https://github.com/capralifecycle/repo-b",
  },
  {
    id: 3,
    name: "repo-c",
    provider: "github",
    external_repo_id: "R_c",
    url: "https://github.com/capralifecycle/repo-c",
  },
]

const ISSUES = [
  // repo-a group 10 appears twice with different severities -> dedupe, keep critical;
  // title comes from the affected package.
  issue({
    id: 100,
    group_id: 10,
    severity: "high",
    type: "open_source",
    repo: 1,
    affected_package: "fast-uri",
  }),
  issue({
    id: 101,
    group_id: 10,
    severity: "critical",
    type: "open_source",
    repo: 1,
    affected_package: "fast-uri",
  }),
  // sast title comes from the rule name.
  issue({
    id: 110,
    group_id: 11,
    severity: "high",
    type: "sast",
    repo: 1,
    rule: "SQL injection",
  }),
  // license is excluded from ISSUE_TYPES.
  issue({ id: 120, group_id: 12, severity: "low", type: "license", repo: 1 }),
  // repo-b group 20: three leaked secrets -> aggregated title.
  issue({
    id: 200,
    group_id: 20,
    severity: "medium",
    type: "leaked_secret",
    repo: 2,
  }),
  issue({
    id: 201,
    group_id: 20,
    severity: "medium",
    type: "leaked_secret",
    repo: 2,
  }),
  issue({
    id: 202,
    group_id: 20,
    severity: "medium",
    type: "leaked_secret",
    repo: 2,
  }),
]

// Ignored issues are fetched separately; one ignored group for repo-a.
const IGNORED = [
  issue({
    id: 900,
    group_id: 90,
    severity: "high",
    type: "open_source",
    repo: 1,
    affected_package: "left-pad",
  }),
]

function issue(opts: {
  id: number
  group_id: number
  severity: string
  type: string
  repo: number
  affected_package?: string | null
  rule?: string | null
}) {
  return {
    id: opts.id,
    group_id: opts.group_id,
    severity: opts.severity,
    type: opts.type,
    code_repo_id: opts.repo,
    code_repo_name: `repo-${opts.repo}`,
    cve_id: `CVE-${opts.group_id}`,
    affected_package: opts.affected_package ?? null,
    rule: opts.rule ?? null,
  }
}

// Routes an /issues/export request to open vs ignored fixtures by filter_status.
function exportResponse(url: string, open: unknown, ignored: unknown) {
  return url.includes("filter_status=ignored")
    ? jsonResponse(ignored)
    : jsonResponse(open)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("getIssueGroupsByRepo", () => {
  test("filters types, dedupes by group id, derives titles, counts ignored", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/oauth/token")) {
          return jsonResponse({ access_token: "tok", token_type: "bearer" })
        }
        if (url.includes("/repositories/code")) return jsonResponse(REPOS)
        if (url.includes("/issues/export")) {
          return exportResponse(url, ISSUES, IGNORED)
        }
        throw new Error(`unexpected url ${url}`)
      }),
    )

    const byRepo = await service().getIssueGroupsByRepo()

    const repoA = byRepo.get("repo-a")
    expect(repoA?.enabled).toBe(true)
    // group 12 (license) excluded; group 10 deduped to one entry.
    expect(repoA?.issueGroups).toHaveLength(2)
    const group10 = repoA?.issueGroups.find((g) => g.groupId === 10)
    expect(group10?.severity).toBe("critical") // highest severity wins
    expect(group10?.issueId).toBe(101) // representative issue = highest severity
    expect(group10?.title).toBe("fast-uri") // title from affected package
    const group11 = repoA?.issueGroups.find((g) => g.groupId === 11)
    expect(group11?.title).toBe("SQL injection") // title from rule name
    // Ignored issues are counted separately.
    expect(repoA?.ignoredCount).toBe(1)

    const repoB = byRepo.get("repo-b")
    expect(repoB?.issueGroups).toEqual([
      {
        groupId: 20,
        issueId: 200,
        severity: "medium",
        type: "leaked_secret",
        title: "3 exposed secrets", // aggregated secret title
      },
    ])

    // Onboarded repo with no issues is enabled with empty counts.
    expect(byRepo.get("repo-c")).toEqual({
      enabled: true,
      issueGroups: [],
      ignoredCount: 0,
    })
  })

  test("repos are also keyed by their URL repo slug", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/oauth/token")) {
          return jsonResponse({ access_token: "tok" })
        }
        if (url.includes("/repositories/code")) {
          return jsonResponse([
            {
              id: 9,
              name: "Display Name",
              provider: "github",
              external_repo_id: "R_x",
              url: "https://github.com/capralifecycle/actual-slug",
            },
          ])
        }
        if (url.includes("/issues/export")) return jsonResponse([])
        throw new Error(`unexpected url ${url}`)
      }),
    )

    const byRepo = await service().getIssueGroupsByRepo()
    expect(byRepo.get("actual-slug")?.enabled).toBe(true)
    expect(byRepo.get("display name")?.enabled).toBe(true)
  })

  test("retries on 429 honoring Retry-After", async () => {
    let reposCalls = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/oauth/token")) {
          return jsonResponse({ access_token: "tok" })
        }
        if (url.includes("/repositories/code")) {
          reposCalls++
          if (reposCalls === 1) {
            return jsonResponse(
              { error: "rate limited" },
              { status: 429, headers: { "retry-after": "0" } },
            )
          }
          return jsonResponse(REPOS)
        }
        if (url.includes("/issues/export")) return jsonResponse([])
        throw new Error(`unexpected url ${url}`)
      }),
    )

    const byRepo = await service().getIssueGroupsByRepo()
    expect(reposCalls).toBe(2)
    expect(byRepo.get("repo-a")?.enabled).toBe(true)
  })

  test("throws on token exchange failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/oauth/token")) {
          return jsonResponse({ error: "nope" }, { status: 401 })
        }
        return jsonResponse([])
      }),
    )

    await expect(service().getIssueGroupsByRepo()).rejects.toThrow(
      /token exchange failed/,
    )
  })
})

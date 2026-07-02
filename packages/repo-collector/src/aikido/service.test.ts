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
  // repo-a group 10 appears twice with different severities -> dedupe, keep critical.
  issue({ group_id: 10, severity: "high", type: "open_source", repo: 1 }),
  issue({ group_id: 10, severity: "critical", type: "open_source", repo: 1 }),
  issue({ group_id: 11, severity: "high", type: "sast", repo: 1 }),
  // license is excluded from ISSUE_TYPES.
  issue({ group_id: 12, severity: "low", type: "license", repo: 1 }),
  issue({ group_id: 20, severity: "medium", type: "leaked_secret", repo: 2 }),
]

function issue(opts: {
  group_id: number
  severity: string
  type: string
  repo: number
}) {
  return {
    group_id: opts.group_id,
    severity: opts.severity,
    type: opts.type,
    code_repo_id: opts.repo,
    code_repo_name: `repo-${opts.repo}`,
    cve_id: `CVE-${opts.group_id}`,
    affected_package: null,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("getIssueGroupsByRepo", () => {
  test("filters types, dedupes by group id, groups per repo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/oauth/token")) {
          return jsonResponse({ access_token: "tok", token_type: "bearer" })
        }
        if (url.includes("/repositories/code")) return jsonResponse(REPOS)
        if (url.includes("/issues/export")) return jsonResponse(ISSUES)
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
    expect(group10?.name).toBe("CVE-10")

    const repoB = byRepo.get("repo-b")
    expect(repoB?.issueGroups).toEqual([
      {
        groupId: 20,
        severity: "medium",
        type: "leaked_secret",
        name: "CVE-20",
      },
    ])

    // Onboarded repo with no issues is enabled with an empty list.
    expect(byRepo.get("repo-c")).toEqual({ enabled: true, issueGroups: [] })
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

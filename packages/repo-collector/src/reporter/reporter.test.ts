import { Temporal } from "@js-temporal/polyfill"
import type {
  AikidoSeverity,
  SnapshotData,
  SnapshotMetrics,
} from "@liflig/repo-metrics-repo-collector-types"
import { describe, expect, test } from "vitest"
import {
  buildPerTeamMessages,
  buildReportData,
  countSeveritiesForRepo,
  findOldPrs,
} from "./reporter"

const now = Temporal.Instant.from("2026-05-18T07:00:00Z")

function repo(overrides: Partial<SnapshotMetrics> = {}): SnapshotMetrics {
  return {
    version: "1.2",
    repoId: "org/repo",
    responsible: "team-a",
    github: {
      orgName: "org",
      repoName: "repo",
      prs: [],
      renovateDependencyDashboardIssue: null,
    },
    ...overrides,
  }
}

function aikidoGroups(severities: AikidoSeverity[]): SnapshotMetrics["aikido"] {
  return {
    enabled: true,
    repoId: 1,
    ignoredCount: 0,
    issueGroups: severities.map((severity, i) => ({
      groupId: i + 1,
      severity,
      type: "open_source",
      title: `pkg-${i}`,
    })),
  }
}

function repoWithAikidoVulns(
  overrides: Partial<SnapshotMetrics> & { severities: AikidoSeverity[] },
): SnapshotMetrics {
  const { severities, ...rest } = overrides
  return repo({ ...rest, aikido: aikidoGroups(severities) })
}

describe("countSeveritiesForRepo", () => {
  test("sums Aikido severities", () => {
    const result = countSeveritiesForRepo(
      repoWithAikidoVulns({
        severities: [
          "critical",
          "high",
          "high",
          "medium",
          "medium",
          "medium",
          "low",
          "low",
          "low",
          "low",
        ],
      }),
    )
    expect(result).toStrictEqual({ critical: 1, high: 2, medium: 3, low: 4 })
  })

  test("treats missing Aikido data as no vulns", () => {
    expect(countSeveritiesForRepo(repo())).toStrictEqual({
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    })
  })
})

describe("findOldPrs", () => {
  test("filters bot authors", () => {
    const old = now.subtract({ hours: 24 * 40 }).toString()
    const prs = findOldPrs(
      repo({
        github: {
          orgName: "org",
          repoName: "repo",
          renovateDependencyDashboardIssue: null,
          prs: [
            {
              number: 1,
              author: { login: "renovate" },
              title: "deps",
              createdAt: old,
              updatedAt: old,
            },
            {
              number: 2,
              author: { login: "dependabot" },
              title: "deps",
              createdAt: old,
              updatedAt: old,
            },
            {
              number: 4,
              author: { login: "alice" },
              title: "real work",
              createdAt: old,
              updatedAt: old,
            },
          ],
        },
      }),
      now,
    )
    expect(prs).toStrictEqual([
      { prNumber: 4, title: "real work", author: "alice", ageDays: 40 },
    ])
  })

  test("filters PRs below age threshold", () => {
    const recent = now.subtract({ hours: 24 * 5 }).toString()
    const prs = findOldPrs(
      repo({
        github: {
          orgName: "org",
          repoName: "repo",
          renovateDependencyDashboardIssue: null,
          prs: [
            {
              number: 1,
              author: { login: "alice" },
              title: "x",
              createdAt: recent,
              updatedAt: recent,
            },
          ],
        },
      }),
      now,
    )
    expect(prs).toStrictEqual([])
  })
})

describe("buildReportData", () => {
  test("groups by team alphabetically and computes totals", () => {
    const snapshot: SnapshotData = {
      timestamp: now.toString(),
      metrics: [
        repoWithAikidoVulns({
          repoId: "org/zeta",
          responsible: "team-b",
          severities: ["critical"],
        }),
        repoWithAikidoVulns({
          repoId: "org/alpha",
          responsible: "team-a",
          severities: ["high", "high"],
        }),
        repo({ repoId: "org/clean", responsible: "team-c" }),
      ],
    }

    const data = buildReportData(snapshot, now)
    expect(Object.keys(data.vulnReposByTeam)).toStrictEqual([
      "team-a",
      "team-b",
    ])
    expect(data.totals).toStrictEqual({
      critical: 1,
      high: 2,
      medium: 0,
      low: 0,
    })
    expect(data.reposWithVulnsCount).toBe(2)
  })
})

describe("buildPerTeamMessages", () => {
  test("produces one message per team with header carrying totals", () => {
    const snapshot: SnapshotData = {
      timestamp: now.toString(),
      metrics: [
        repoWithAikidoVulns({
          repoId: "org/a",
          responsible: "team-a",
          severities: [
            "critical",
            "high",
            "high",
            "medium",
            "medium",
            "medium",
            "low",
            "low",
            "low",
            "low",
          ],
        }),
        repoWithAikidoVulns({
          repoId: "org/b",
          responsible: "team-b",
          severities: ["high"],
        }),
      ],
    }
    const messages = buildPerTeamMessages(
      buildReportData(snapshot, now),
      "https://example/",
    )
    expect(messages.length).toBe(2)
    const teamAMessage = messages[0]
    // Notification fallback text still carries the severity breakdown.
    expect(teamAMessage.text).toBe(
      "team-a — 🟥 1 · 🟧 2 · 🟨 3 · 🟦 4 · Sum 10",
    )
    // Header above the table is just the data set + team, no counts.
    expect(teamAMessage.blocks[0]).toMatchObject({
      type: "header",
      text: { text: "Sårbarheter — team-a" },
    })
    const snapshotSection = teamAMessage.blocks[1]
    expect(snapshotSection).toMatchObject({ type: "section" })
    if (snapshotSection.type !== "section" || !snapshotSection.text)
      throw new Error("expected section with text")
    expect(snapshotSection.text.text).toContain("Snapshot: ")
    expect(snapshotSection.text.text).toContain(
      "https://example/?selectedTeams=team-a",
    )
  })

  test("renders severities as table columns with a totals row", () => {
    const snapshot: SnapshotData = {
      timestamp: now.toString(),
      metrics: [
        repoWithAikidoVulns({
          repoId: "org/alpha",
          responsible: "team-a",
          severities: ["high", "high", "medium", "medium", "medium"],
        }),
        repoWithAikidoVulns({
          repoId: "org/beta",
          responsible: "team-a",
          severities: ["critical"],
        }),
        // No vulns — must not appear as a table row.
        repo({ repoId: "org/clean", responsible: "team-a" }),
      ],
    }
    const [message] = buildPerTeamMessages(
      buildReportData(snapshot, now),
      "https://example/",
    )

    const table = message.blocks.find((b) => b.type === "table")
    if (table?.type !== "table") throw new Error("expected a table block")

    const rawText = (cell: unknown): string | undefined =>
      typeof cell === "object" &&
      cell !== null &&
      (cell as any).type === "raw_text"
        ? (cell as any).text
        : undefined

    const [headerRow, ...rest] = table.rows
    const totalsRow = rest[rest.length - 1]
    const bodyRows = rest.slice(0, -1)

    expect(headerRow.map(rawText)).toStrictEqual([
      "Repo",
      "🟥 Critical",
      "🟧 High",
      "🟨 Medium",
      "🟦 Low",
      "Σ",
    ])
    // Clean repo dropped; only the two vulnerable repos remain.
    expect(bodyRows.length).toBe(2)
    // Grand totals; the empty Low column renders blank, not "0".
    expect(totalsRow.map(rawText)).toStrictEqual([
      "Sum",
      "1",
      "2",
      "3",
      " ",
      "6",
    ])
  })

  test("table repo cells link by repo name only (no org prefix)", () => {
    const snapshot: SnapshotData = {
      timestamp: now.toString(),
      metrics: [
        repoWithAikidoVulns({
          repoId: "liflig/liflig-logging",
          github: {
            orgName: "liflig",
            repoName: "liflig-logging",
            prs: [],
            renovateDependencyDashboardIssue: null,
          },
          responsible: "team-a",
          severities: ["high"],
        }),
      ],
    }
    const [message] = buildPerTeamMessages(
      buildReportData(snapshot, now),
      "https://example/",
    )
    const json = JSON.stringify(message)
    expect(json).toContain(
      "https://example/?filterRepoName=liflig-logging&showVulAikidoList=true",
    )
    expect(json).toContain('"text":"liflig-logging"')
    expect(json).not.toContain('"text":"liflig/liflig-logging"')
  })
})

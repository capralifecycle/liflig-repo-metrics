import { Temporal } from "@js-temporal/polyfill"
import type {
  GitHubVulnerabilityAlert,
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
      vulnerabilityAlerts: [],
      renovateDependencyDashboardIssue: null,
    },
    ...overrides,
  }
}

function ghAlert(
  severity: GitHubVulnerabilityAlert["securityAdvisory"] extends null
    ? never
    : NonNullable<GitHubVulnerabilityAlert["securityAdvisory"]>["severity"],
): GitHubVulnerabilityAlert {
  return {
    state: "OPEN",
    dismissReason: null,
    vulnerableManifestFilename: "",
    vulnerableManifestPath: "",
    vulnerableRequirements: null,
    securityAdvisory: {
      description: "",
      identifiers: [],
      references: [],
      severity,
    },
    securityVulnerability: null,
  }
}

function repoWithGhVulns(
  overrides: Partial<SnapshotMetrics> & {
    severities: ("CRITICAL" | "HIGH" | "MODERATE" | "LOW")[]
  },
): SnapshotMetrics {
  const { severities, ...rest } = overrides
  return repo({
    ...rest,
    github: {
      orgName: "org",
      repoName: "repo",
      prs: [],
      vulnerabilityAlerts: severities.map(ghAlert),
      renovateDependencyDashboardIssue: null,
    },
  })
}

describe("countSeveritiesForRepo", () => {
  test("sums GitHub severities", () => {
    const result = countSeveritiesForRepo(
      repo({
        github: {
          orgName: "org",
          repoName: "repo",
          prs: [],
          renovateDependencyDashboardIssue: null,
          vulnerabilityAlerts: [
            ghAlert("CRITICAL"),
            ghAlert("HIGH"),
            ghAlert("HIGH"),
            ghAlert("MODERATE"),
            ghAlert("MODERATE"),
            ghAlert("MODERATE"),
            ghAlert("LOW"),
            ghAlert("LOW"),
            ghAlert("LOW"),
            ghAlert("LOW"),
          ],
        },
      }),
    )
    expect(result).toStrictEqual({ critical: 1, high: 2, medium: 3, low: 4 })
  })

  test("maps GitHub MODERATE to medium and ignores dismissed alerts", () => {
    const result = countSeveritiesForRepo(
      repo({
        github: {
          orgName: "org",
          repoName: "repo",
          prs: [],
          renovateDependencyDashboardIssue: null,
          vulnerabilityAlerts: [
            {
              state: "OPEN",
              dismissReason: null,
              vulnerableManifestFilename: "",
              vulnerableManifestPath: "",
              vulnerableRequirements: null,
              securityAdvisory: {
                description: "",
                identifiers: [],
                references: [],
                severity: "CRITICAL",
              },
              securityVulnerability: null,
            },
            {
              state: "OPEN",
              dismissReason: null,
              vulnerableManifestFilename: "",
              vulnerableManifestPath: "",
              vulnerableRequirements: null,
              securityAdvisory: {
                description: "",
                identifiers: [],
                references: [],
                severity: "MODERATE",
              },
              securityVulnerability: null,
            },
            {
              state: "DISMISSED",
              dismissReason: "fix_started",
              vulnerableManifestFilename: "",
              vulnerableManifestPath: "",
              vulnerableRequirements: null,
              securityAdvisory: {
                description: "",
                identifiers: [],
                references: [],
                severity: "HIGH",
              },
              securityVulnerability: null,
            },
          ],
        },
      }),
    )
    expect(result).toStrictEqual({ critical: 1, high: 0, medium: 1, low: 0 })
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
          vulnerabilityAlerts: [],
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
          vulnerabilityAlerts: [],
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
        repoWithGhVulns({
          repoId: "org/zeta",
          responsible: "team-b",
          severities: ["CRITICAL"],
        }),
        repoWithGhVulns({
          repoId: "org/alpha",
          responsible: "team-a",
          severities: ["HIGH", "HIGH"],
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
        repoWithGhVulns({
          repoId: "org/a",
          responsible: "team-a",
          severities: [
            "CRITICAL",
            "HIGH",
            "HIGH",
            "MODERATE",
            "MODERATE",
            "MODERATE",
            "LOW",
            "LOW",
            "LOW",
            "LOW",
          ],
        }),
        repoWithGhVulns({
          repoId: "org/b",
          responsible: "team-b",
          severities: ["HIGH"],
        }),
      ],
    }
    const messages = buildPerTeamMessages(
      buildReportData(snapshot, now),
      "https://example/",
    )
    expect(messages.length).toBe(2)
    const teamAMessage = messages[0]
    expect(teamAMessage.text).toBe(
      "team-a — 🟥 1 · 🟧 2 · 🟨 3 · 🟦 4 · Sum 10",
    )
    expect(teamAMessage.blocks[0]).toMatchObject({ type: "header" })
    const snapshotSection = teamAMessage.blocks[1]
    expect(snapshotSection).toMatchObject({ type: "section" })
    if (snapshotSection.type !== "section" || !snapshotSection.text)
      throw new Error("expected section with text")
    expect(snapshotSection.text.text).toContain("Snapshot: ")
    expect(snapshotSection.text.text).toContain(
      "https://example/?selectedTeams=team-a",
    )
  })

  test("severity sections only include severities with non-zero totals", () => {
    const snapshot: SnapshotData = {
      timestamp: now.toString(),
      metrics: [
        repoWithGhVulns({
          repoId: "org/alpha",
          responsible: "team-a",
          severities: ["HIGH", "HIGH", "MODERATE", "MODERATE", "MODERATE"],
        }),
        repoWithGhVulns({
          repoId: "org/beta",
          responsible: "team-a",
          severities: ["CRITICAL"],
        }),
      ],
    }
    const [message] = buildPerTeamMessages(
      buildReportData(snapshot, now),
      "https://example/",
    )
    const sectionTexts = message.blocks
      .filter((b) => b.type === "section")
      .map((b) => b.text?.text ?? "")

    const critical = sectionTexts.find((t) => t.startsWith("🟥"))
    const high = sectionTexts.find((t) => t.startsWith("🟧"))
    const medium = sectionTexts.find((t) => t.startsWith("🟨"))
    const low = sectionTexts.find((t) => t.startsWith("🟦"))

    expect(critical).toContain("*Critical (1)*")
    expect(critical).toContain(" 1")
    expect(high).toContain("*High (2)*")
    expect(high).toContain(" 2")
    expect(medium).toContain("*Medium (3)*")
    expect(medium).toContain(" 3")
    expect(low).toBeUndefined()
  })

  test("severity-section links use repo name only (no org prefix)", () => {
    const snapshot: SnapshotData = {
      timestamp: now.toString(),
      metrics: [
        repo({
          repoId: "liflig/liflig-logging",
          github: {
            orgName: "liflig",
            repoName: "liflig-logging",
            prs: [],
            vulnerabilityAlerts: [ghAlert("HIGH")],
            renovateDependencyDashboardIssue: null,
          },
          responsible: "team-a",
        }),
      ],
    }
    const [message] = buildPerTeamMessages(
      buildReportData(snapshot, now),
      "https://example/",
    )
    const json = JSON.stringify(message)
    expect(json).toContain(
      "https://example/?filterRepoName=liflig-logging&showVulGithubList=true",
    )
    expect(json).toContain("|liflig-logging>")
    expect(json).not.toContain("|liflig/liflig-logging>")
  })
})

import type { SnapshotMetrics } from "@liflig/repo-metrics-repo-collector-types"
import { describe, expect, test } from "vitest"
import { selectCoverage } from "./webapp"

function sonar(value?: string): SnapshotMetrics["sonarCloud"] {
  return {
    component: {
      id: "id",
      key: "org_repo",
      name: "repo",
      qualifier: "TRK",
      measures: value === undefined ? [] : [{ metric: "coverage", value }],
    },
  }
}

function aikido(percentage?: number): SnapshotMetrics["aikido"] {
  return {
    enabled: true,
    repoId: 1,
    issueGroups: [],
    ignoredCount: 0,
    coverage:
      percentage === undefined
        ? undefined
        : { percentage, branch: "main", updatedAt: "2026-10-21T00:00:00Z" },
  }
}

describe("selectCoverage", () => {
  test.each([
    {
      claim: "prefers Aikido when both sources report coverage",
      input: { aikido: aikido(62), sonarCloud: sonar("80.0") },
      expected: { source: "aikido", percentage: 62 },
    },
    {
      claim: "falls back to SonarCloud when Aikido has no coverage",
      input: { aikido: aikido(), sonarCloud: sonar("80.4") },
      expected: { source: "sonarcloud", percentage: 80.4 },
    },
    {
      claim: "falls back to SonarCloud on snapshots without Aikido data",
      input: { sonarCloud: sonar("55") },
      expected: { source: "sonarcloud", percentage: 55 },
    },
    {
      claim: "uses Aikido when SonarCloud is not set up",
      input: { aikido: aikido(71.25) },
      expected: { source: "aikido", percentage: 71.3 },
    },
    {
      claim: "is null when SonarCloud is set up without a coverage measure",
      input: { sonarCloud: sonar() },
      expected: null,
    },
    {
      claim: "is null when SonarCloud reports a non-numeric value",
      input: { sonarCloud: sonar("n/a") },
      expected: null,
    },
    {
      claim: "is null when neither source reports coverage",
      input: { aikido: aikido() },
      expected: null,
    },
  ])("$claim", ({ input, expected }) => {
    expect(selectCoverage(input)).toEqual(expected)
  })
})

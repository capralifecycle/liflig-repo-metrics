import type { SnapshotMetrics } from "@liflig/repo-metrics-repo-collector-types"
import { describe, expect, test } from "vitest"
import { aikidoCoverage } from "./webapp"

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

describe("aikidoCoverage", () => {
  test.each([
    {
      claim: "keeps a whole percentage as is",
      input: { aikido: aikido(62) },
      expected: { percentage: 62 },
    },
    {
      claim: "rounds to one decimal",
      input: { aikido: aikido(71.25) },
      expected: { percentage: 71.3 },
    },
    {
      claim: "is null when Aikido has no coverage for the repo",
      input: { aikido: aikido() },
      expected: null,
    },
    {
      claim: "is null on snapshots without Aikido data",
      input: {},
      expected: null,
    },
  ])("$claim", ({ input, expected }) => {
    expect(aikidoCoverage(input)).toEqual(expected)
  })
})

import type { Metrics } from "@liflig/repo-metrics-repo-collector-types"

type PR = Metrics["github"]["prs"][0]

export function isBotPr(pr: PR): boolean {
  return (
    ["dependabot", "renovate"].includes(pr.author) ||
    pr.title.startsWith("[Snyk]")
  )
}

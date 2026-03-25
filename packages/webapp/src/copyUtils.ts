import type { Repo } from "@liflig/repo-metrics-repo-collector-types"
import { isBotPr } from "./prUtils"

function formatTimestamp(ts: string): string {
  const [date, rest] = ts.split("T")
  const time = rest.split(".")[0]
  return `${date} ${time}`
}

export interface SummaryOptions {
  repos: Repo[]
  team: string
  aggregatedAt: string
}

export function buildMarkdownSummary({
  repos,
  team,
  aggregatedAt,
}: SummaryOptions): string {
  const lines: string[] = []

  lines.push(`## ${team}`)
  lines.push(`_Sist oppdatert: ${formatTimestamp(aggregatedAt)}_`)
  lines.push("")

  const rows = repos
    .map((repo) => {
      const prs = repo.metrics.github.prs.filter((p) => !isBotPr(p)).length
      const botPrs = repo.metrics.github.prs.filter((p) => isBotPr(p)).length
      const ghVul = repo.metrics.github.vulnerabilityAlerts.length
      const snykVul = repo.metrics.snyk?.totalIssues ?? 0
      return { name: repo.name, prs, botPrs, ghVul, snykVul }
    })
    .filter((r) => r.prs > 0 || r.botPrs > 0 || r.ghVul > 0 || r.snykVul > 0)

  if (rows.length === 0) {
    lines.push("Ingen aktive saker.")
    return lines.join("\n")
  }

  lines.push("| Repo | PRs | Bot PRs | GitHub Vul | Snyk |")
  lines.push("| --- | --- | --- | --- | --- |")
  for (const r of rows) {
    const cell = (n: number) => (n > 0 ? String(n) : "")
    lines.push(
      `| ${r.name} | ${cell(r.prs)} | ${cell(r.botPrs)} | ${cell(r.ghVul)} | ${cell(r.snykVul)} |`,
    )
  }
  lines.push("")

  return lines.join("\n")
}

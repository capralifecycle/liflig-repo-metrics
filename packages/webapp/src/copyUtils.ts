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
  lines.push(`_Last updated: ${formatTimestamp(aggregatedAt)}_`)
  lines.push("")

  const rows = repos
    .map((repo) => {
      const prs = repo.metrics.github.prs.filter((p) => !isBotPr(p)).length
      const botPrs = repo.metrics.github.prs.filter((p) => isBotPr(p)).length
      return { name: repo.name, prs, botPrs }
    })
    .filter((r) => r.prs > 0 || r.botPrs > 0)

  if (rows.length === 0) {
    lines.push("No active items.")
    return lines.join("\n")
  }

  lines.push("| Repo | PRs | Bot PRs |")
  lines.push("| --- | --- | --- |")
  for (const r of rows) {
    const cell = (n: number) => (n > 0 ? String(n) : "")
    lines.push(`| ${r.name} | ${cell(r.prs)} | ${cell(r.botPrs)} |`)
  }
  lines.push("")

  return lines.join("\n")
}

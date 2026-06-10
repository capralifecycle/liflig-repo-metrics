import { Temporal } from "@js-temporal/polyfill"
import type {
  GitHubVulnerabilityAlert,
  SnapshotData,
  SnapshotMetrics,
} from "@liflig/repo-metrics-repo-collector-types"
import type { HeaderBlock, SectionBlock } from "@slack/types"
import axios from "axios"
import { groupBy, sortBy } from "lodash-es"

type SlackBlock = HeaderBlock | SectionBlock

export const OLD_PR_DAYS_THRESHOLD = 30

const UNKNOWN_RESPONSIBLE = "Ukjent"

export interface SeverityCounts {
  critical: number
  high: number
  medium: number
  low: number
}

interface RepoRef {
  repoId: string
  orgName: string
  repoName: string
  responsible: string
}

export interface VulnRepoEntry extends RepoRef {
  severities: SeverityCounts
  total: number
}

export interface OldPrEntry extends RepoRef {
  prNumber: number
  title: string
  author: string
  ageDays: number
}

export interface ReportData {
  timestamp: string
  totals: SeverityCounts
  reposWithVulnsCount: number
  vulnReposByTeam: Record<string, VulnRepoEntry[]>
  oldPrsByTeam: Record<string, OldPrEntry[]>
}

function zeroSeverities(): SeverityCounts {
  return { critical: 0, high: 0, medium: 0, low: 0 }
}

function addSeverities(a: SeverityCounts, b: SeverityCounts): SeverityCounts {
  return {
    critical: a.critical + b.critical,
    high: a.high + b.high,
    medium: a.medium + b.medium,
    low: a.low + b.low,
  }
}

function totalOf(s: SeverityCounts): number {
  return s.critical + s.high + s.medium + s.low
}

function githubSeverities(alerts: GitHubVulnerabilityAlert[]): SeverityCounts {
  const counts = zeroSeverities()
  for (const alert of alerts) {
    const open =
      alert.state == null ? alert.dismissReason == null : alert.state === "OPEN"
    if (!open) continue
    const sev = alert.securityAdvisory?.severity
    if (sev === "CRITICAL") counts.critical += 1
    else if (sev === "HIGH") counts.high += 1
    else if (sev === "MODERATE") counts.medium += 1
    else if (sev === "LOW") counts.low += 1
    else counts.medium += 1
  }
  return counts
}

export function countSeveritiesForRepo(metrics: {
  github: { vulnerabilityAlerts: GitHubVulnerabilityAlert[] }
}): SeverityCounts {
  return githubSeverities(metrics.github.vulnerabilityAlerts)
}

function daysBetween(from: Temporal.Instant, to: Temporal.Instant): number {
  const diffMs = to.epochMilliseconds - from.epochMilliseconds
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

function isBotPr(pr: { author: string; title: string }): boolean {
  return (
    ["dependabot", "renovate"].includes(pr.author) ||
    pr.title.startsWith("[Snyk]")
  )
}

export function findOldPrs(
  metrics: SnapshotMetrics,
  now: Temporal.Instant,
): {
  prNumber: number
  title: string
  author: string
  ageDays: number
}[] {
  return metrics.github.prs.flatMap((pr) => {
    const author = pr.author.login
    if (isBotPr({ author, title: pr.title })) return []
    const ageDays = daysBetween(Temporal.Instant.from(pr.createdAt), now)
    if (ageDays < OLD_PR_DAYS_THRESHOLD) return []
    return [{ prNumber: pr.number, title: pr.title, author, ageDays }]
  })
}

function refOf(metrics: SnapshotMetrics): RepoRef {
  return {
    repoId: metrics.repoId,
    orgName: metrics.github.orgName,
    repoName: metrics.github.repoName,
    responsible: metrics.responsible ?? UNKNOWN_RESPONSIBLE,
  }
}

function groupByResponsibleSorted<T extends { responsible: string }>(
  items: T[],
  sortKey: (item: T) => string | number,
): Record<string, T[]> {
  const grouped = groupBy(items, (it) => it.responsible)
  const result: Record<string, T[]> = {}
  for (const team of Object.keys(grouped).sort((a, b) =>
    a.localeCompare(b, "no"),
  )) {
    result[team] = sortBy(grouped[team], sortKey)
  }
  return result
}

export function buildReportData(
  snapshotData: SnapshotData,
  now: Temporal.Instant,
): ReportData {
  const vulnEntries: VulnRepoEntry[] = []
  const oldPrEntries: OldPrEntry[] = []

  for (const metrics of snapshotData.metrics) {
    const ref = refOf(metrics)

    const severities = countSeveritiesForRepo(metrics)
    if (totalOf(severities) > 0) {
      vulnEntries.push({ ...ref, severities, total: totalOf(severities) })
    }

    for (const pr of findOldPrs(metrics, now)) {
      oldPrEntries.push({ ...ref, ...pr })
    }
  }

  const totals = vulnEntries.reduce<SeverityCounts>(
    (acc, e) => addSeverities(acc, e.severities),
    zeroSeverities(),
  )

  return {
    timestamp: snapshotData.timestamp,
    totals,
    reposWithVulnsCount: vulnEntries.length,
    vulnReposByTeam: groupByResponsibleSorted(vulnEntries, (e) => e.repoId),
    oldPrsByTeam: groupByResponsibleSorted(oldPrEntries, (e) => -e.ageDays),
  }
}

function webappUrl(
  webappBaseUrl: string,
  params: Record<string, string>,
): string {
  const base = webappBaseUrl.replace(/\/+$/, "")
  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&")
  return `${base}/?${query}`
}

function githubPrUrl(
  orgName: string,
  repoName: string,
  prNumber: number,
): string {
  return `https://github.com/${orgName}/${repoName}/pull/${prNumber}`
}

const SEV_CRITICAL = "🟥"
const SEV_HIGH = "🟧"
const SEV_MEDIUM = "🟨"
const SEV_LOW = "🟦"

function teamTitle(team: string, totals: SeverityCounts): string {
  return (
    `${team} — ` +
    `${SEV_CRITICAL} ${totals.critical} · ` +
    `${SEV_HIGH} ${totals.high} · ` +
    `${SEV_MEDIUM} ${totals.medium} · ` +
    `${SEV_LOW} ${totals.low} · ` +
    `Sum ${totalOf(totals)}`
  )
}

function formatDateTimeNo(timestamp: string): string {
  const d = Temporal.Instant.from(timestamp).toZonedDateTimeISO("Europe/Oslo")
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.day)}.${pad(d.month)}.${d.year} ${pad(d.hour)}:${pad(d.minute)}`
}

function header(text: string): HeaderBlock {
  return { type: "header", text: { type: "plain_text", text, emoji: true } }
}

function section(markdown: string): SectionBlock {
  return { type: "section", text: { type: "mrkdwn", text: markdown } }
}

// Slack section blocks cap text at 3000 chars.
const SECTION_TEXT_LIMIT = 2900

// Chunks `lines` across one or more section blocks, never exceeding Slack's
// 3000-char section text limit. Optional `head` is prepended to the first
// section's text; `cont` is prepended to each continuation section.
function chunkLines(
  lines: string[],
  options: { head?: string; cont?: string } = {},
): SectionBlock[] {
  const sections: SectionBlock[] = []
  let prefix = options.head ?? ""
  let buf: string[] = []
  let len = prefix.length

  const flush = () => {
    if (buf.length === 0) return
    sections.push(
      section(prefix ? `${prefix}\n${buf.join("\n")}` : buf.join("\n")),
    )
    buf = []
    prefix = options.cont ?? ""
    len = prefix.length
  }

  for (const line of lines) {
    const added = line.length + 1
    if (len + added > SECTION_TEXT_LIMIT && buf.length > 0) flush()
    buf.push(line)
    len += added
  }
  flush()
  return sections
}

const SEVERITY_DEFS = [
  { key: "critical", emoji: SEV_CRITICAL, label: "Critical" },
  { key: "high", emoji: SEV_HIGH, label: "High" },
  { key: "medium", emoji: SEV_MEDIUM, label: "Medium" },
  { key: "low", emoji: SEV_LOW, label: "Low" },
] as const

// One section per non-empty severity, header "<emoji> *Label (total)*" plus
// a bullet line per repo: "• <link|repo-name> N".
function buildSeveritySections(
  items: VulnRepoEntry[],
  webappBaseUrl: string,
): SectionBlock[] {
  return SEVERITY_DEFS.flatMap((sev) => {
    const repos = items.filter((e) => e.severities[sev.key] > 0)
    if (repos.length === 0) return []
    const total = repos.reduce((acc, e) => acc + e.severities[sev.key], 0)
    const bullets = repos.map((e) => {
      const url = webappUrl(webappBaseUrl, {
        filterRepoName: e.repoName,
        showVulGithubList: "true",
      })
      const link = `<${url}|${e.repoName}>`
      return `• ${link} ${e.severities[sev.key]}`
    })
    return chunkLines(bullets, {
      head: `${sev.emoji} *${sev.label} (${total})*`,
      cont: `${sev.emoji} *${sev.label} (forts.)*`,
    })
  })
}

export interface SlackMessage {
  text: string
  blocks: SlackBlock[]
}

export function buildPerTeamMessages(
  reportData: ReportData,
  webappBaseUrl: string,
): SlackMessage[] {
  const messages: SlackMessage[] = []
  const snapshotAt = formatDateTimeNo(reportData.timestamp)

  for (const [team, items] of Object.entries(reportData.vulnReposByTeam)) {
    // Per-team totals — distinct from reportData.totals which is the grand
    // total across all teams.
    const totals = items.reduce<SeverityCounts>(
      (acc, e) => addSeverities(acc, e.severities),
      zeroSeverities(),
    )

    const dashboardUrl = webappUrl(webappBaseUrl, { selectedTeams: team })

    const blocks: SlackBlock[] = [
      header(teamTitle(team, totals)),
      section(`Snapshot: ${snapshotAt} · <${dashboardUrl}|Åpne dashboard>`),
      ...buildSeveritySections(items, webappBaseUrl),
    ]

    const teamOldPrs = reportData.oldPrsByTeam[team] ?? []
    if (teamOldPrs.length > 0) {
      blocks.push(
        header(`Gamle PR-er (>${OLD_PR_DAYS_THRESHOLD} dager, ekskl. bots)`),
      )
      blocks.push(
        ...chunkLines(
          teamOldPrs.map((e) => {
            const url = githubPrUrl(e.orgName, e.repoName, e.prNumber)
            const repoLabel = `${e.orgName}/${e.repoName}`
            const title =
              e.title.length > 80 ? `${e.title.slice(0, 77)}…` : e.title
            return `• *${repoLabel}* — <${url}|#${e.prNumber} ${title}> — @${e.author}, ${e.ageDays} dager`
          }),
        ),
      )
    }

    messages.push({
      text: teamTitle(team, totals),
      blocks,
    })
  }

  return messages
}

export async function sendSlackMessages(
  slackWebhookUrl: string,
  messages: SlackMessage[],
): Promise<void> {
  for (const message of messages) {
    await axios.post(slackWebhookUrl, message)
  }
}

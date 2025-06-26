import { Temporal } from "@js-temporal/polyfill"
import type {
  GitHubVulnerabilityAlert,
  SnapshotData,
  SnapshotMetrics,
} from "@liflig/repo-metrics-repo-collector-types"
import axios from "axios"
import { groupBy, sortBy } from "lodash-es"
import { isWorkingDay } from "../dates"

interface ReportData {
  timestamp: string
  repos: ReportRepo[]
}

interface ReportRepo {
  repoId: string
  sumVulnerabilities: number
  responsible: string
}

export async function formatReportData(
  snapshotData: SnapshotData,
): Promise<ReportData | null> {
  const reporterRepos = snapshotData.metrics.flatMap<ReportRepo>((metrics) => {
    const sumVulnerabilities =
      sumSnykSeverities(metrics.snyk.projects) +
      sumGithubVuls(metrics.github.vulnerabilityAlerts)

    return sumVulnerabilities == 0
      ? []
      : [
          {
            repoId: metrics.repoId,
            sumVulnerabilities,
            responsible: metrics.responsible ?? "Ukjent",
          },
        ]
  })

  return {
    timestamp: snapshotData.timestamp,
    repos: reporterRepos,
  }
}

export function generateMessage(reportData: ReportData): string {
  const reposByResponsible = groupBy(
    reportData.repos,
    (repo) => repo.responsible,
  )

  const data = sortBy(
    Object.values(reposByResponsible),
    (it) => it[0].responsible,
  ).map<string>((diffItems) => {
    return (
      `${diffItems[0].responsible}:\n` +
      sortBy(diffItems, (repo) => repo.repoId)
        .map((repo) => `${repo.repoId}: ${repo.sumVulnerabilities}`)
        .join("\n")
    )
  })

  const sumVulns = sumVulnerabilities(reportData.repos)

  return `Repo Metrics - Sårbarheter

Totalt antall sårbarheter: ${sumVulns}

${data.length > 0 ? data.join("\n\n") : "Alt OK"}

Siste datapunkt: ${reportData.timestamp}

Detaljer: https://d2799m9v6pw1zy.cloudfront.net/`
}

export async function sendSlackMessage(
  slackWebhookUrl: string,
  message: string,
) {
  await axios.post(slackWebhookUrl, {
    text: message,
  })
}

export function calculateCutoffTimestamp(
  now: Temporal.Instant,
): Temporal.Instant {
  let cutoffDate = now.toZonedDateTimeISO("UTC").toPlainDate()

  do {
    cutoffDate = cutoffDate.subtract({ days: 1 })
  } while (!isWorkingDay(cutoffDate))

  // The job runs 6 am UTC, so pick a time a bit after this.
  return cutoffDate
    .toZonedDateTime({
      plainTime: Temporal.PlainTime.from({ hour: 6, minute: 30 }),
      timeZone: "UTC",
    })
    .toInstant()
}

function sumVulnerabilities(repos: ReportRepo[]) {
  return repos.reduce((acc, cur) => acc + cur.sumVulnerabilities, 0)
}

function sumSnykSeverities(
  projects: SnapshotMetrics["snyk"]["projects"],
): number {
  return projects.reduce(
    (acc, cur) =>
      acc +
      (cur.issueCountsBySeverity.critical ?? 0) +
      cur.issueCountsBySeverity.high +
      cur.issueCountsBySeverity.medium +
      cur.issueCountsBySeverity.low,
    0,
  )
}

function sumGithubVuls(
  vulnerabilityAlerts: GitHubVulnerabilityAlert[],
): number {
  return vulnerabilityAlerts.filter((it) =>
    it.state == null ? it.dismissReason == null : it.state === "OPEN",
  ).length
}

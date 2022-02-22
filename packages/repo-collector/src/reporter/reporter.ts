import { MetricRepoSnapshot } from "@liflig/repo-metrics-repo-collector-types"
import axios from "axios"
import { Dictionary, groupBy, keyBy, maxBy, sortBy } from "lodash"
import { Temporal } from "@js-temporal/polyfill"
import { isWorkingDay } from "../dates"
import { SnapshotsRepository } from "../snapshots/snapshots-repository"

interface ReporterRepo {
  repoId: string
  sumVulnerabilities: number
  responsible: string
}

interface ReporterDetailsData {
  timestamp: Temporal.Instant
  repos: ReporterRepo[]
}

interface ReporterDetails {
  current: ReporterDetailsData
  previous: ReporterDetailsData
}

interface Diff {
  repoId: string
  responsible: string
  sumVulnerabilitiesCurrent: number
  sumVulnerabilitiesPrevious: number
}

export async function sendSlackMessage(
  slackWebhookUrl: string,
  message: string,
) {
  // Don't bother handling failures, let it propagate for now.
  await axios.post(slackWebhookUrl, {
    text: message,
  })
}

export function generateMessage(details: ReporterDetails) {
  const diff = groupBy(generateDiff(details), (it) => it.responsible)

  const data = sortBy(
    Object.values(diff),
    (it) => it[0].responsible,
  ).map<string>((diffItems) => {
    return (
      `${diffItems[0].responsible}:\n` +
      sortBy(diffItems, (it) => it.repoId)
        .map(
          (it) =>
            `${it.repoId}: ${it.sumVulnerabilitiesCurrent}${formatDiff(
              it.sumVulnerabilitiesPrevious,
              it.sumVulnerabilitiesCurrent,
            )}`,
        )
        .join("\n")
    )
  })

  const curVuln = sumVulnerabilities(details.current.repos)
  const prevVuln = sumVulnerabilities(details.previous.repos)

  return `Rapport over sårbarheter

Siste status: ${curVuln}${formatDiff(prevVuln, curVuln)}

${data.length > 0 ? data.join("\n\n") : "Alt OK"}

Siste datapunkt: ${formatTimestamp(details.current.timestamp)}
Sammenliknet mot: ${formatTimestamp(details.previous.timestamp)}

Detaljer: https://d2799m9v6pw1zy.cloudfront.net/`
}

function formatTimestamp(value: Temporal.Instant): string {
  return value.toString()
}

function formatDiff(prev: number, cur: number): string {
  const value = cur - prev
  if (value == 0) return ""
  if (value > 0) return ` (+${value})`
  return ` (${value})`
}

export async function getReporterDetails(
  snapshotsRepository: SnapshotsRepository,
): Promise<ReporterDetails | null> {
  const snapshotsList = await snapshotsRepository.list()

  const now = Temporal.Now.instant()
  const cutoffTimestamp = calculateCutoffTimestamp(now)

  const currentSnapshot = maxBy(
    snapshotsList,
    (it) => it.timestamp.epochNanoseconds,
  )

  const previousSnapshot = maxBy(
    snapshotsList.filter(
      (it) => Temporal.Instant.compare(it.timestamp, cutoffTimestamp) <= 0,
    ),
    (it) => it.timestamp.epochNanoseconds,
  )

  if (!currentSnapshot || !previousSnapshot) return null

  return {
    previous: {
      timestamp: previousSnapshot.timestamp,
      repos: await getRepos(snapshotsRepository, previousSnapshot.timestamp),
    },
    current: {
      timestamp: currentSnapshot.timestamp,
      repos: await getRepos(snapshotsRepository, currentSnapshot.timestamp),
    },
  }
}

function generateDiff(details: ReporterDetails): Diff[] {
  const prevById: Dictionary<ReporterRepo | undefined> = keyBy(
    details.previous.repos,
    (it) => it.repoId,
  )
  const curById: Dictionary<ReporterRepo | undefined> = keyBy(
    details.current.repos,
    (it) => it.repoId,
  )

  const result: Diff[] = []

  for (const item of details.current.repos) {
    const prev = prevById[item.repoId]
    result.push({
      repoId: item.repoId,
      responsible: item.responsible,
      sumVulnerabilitiesCurrent: item.sumVulnerabilities,
      sumVulnerabilitiesPrevious: prev?.sumVulnerabilities ?? 0,
    })
  }

  for (const item of details.previous.repos) {
    if (curById[item.repoId] != null) continue

    result.push({
      repoId: item.repoId,
      responsible: item.responsible,
      sumVulnerabilitiesCurrent: 0,
      sumVulnerabilitiesPrevious: item.sumVulnerabilities,
    })
  }

  return result
}

function sumVulnerabilities(repos: ReporterRepo[]) {
  return repos.reduce((acc, cur) => acc + cur.sumVulnerabilities, 0)
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

async function getRepos(
  snapshotsRepository: SnapshotsRepository,
  timestamp: Temporal.Instant,
): Promise<ReporterRepo[]> {
  const snapshots = await snapshotsRepository.retrieve(timestamp)

  return snapshots.flatMap<ReporterRepo>((it) => {
    const sumVulnerabilities =
      sumSnykSeverities(it.snyk.projects) + sumGithubVuls(it)

    return sumVulnerabilities == 0
      ? []
      : [
          {
            repoId: it.repoId,
            sumVulnerabilities,
            responsible: it.responsible ?? "Ukjent",
          },
        ]
  })
}

function sumSnykSeverities(
  projects: MetricRepoSnapshot["snyk"]["projects"],
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

function sumGithubVuls(datapoint: MetricRepoSnapshot): number {
  return datapoint.github.vulnerabilityAlerts.filter(
    // We need to handle multiple snapshot versions here:
    // Earlier snapshots are missing the `state` field, and rely on `dismissReason`
    // to determine if a vulnerability is open or not.
    (it) => (it.state == null ? it.dismissReason == null : it.state === "OPEN"),
  ).length
}

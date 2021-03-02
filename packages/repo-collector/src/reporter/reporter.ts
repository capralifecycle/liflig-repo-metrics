import { MetricRepoSnapshot } from "@liflig/repo-metrics-repo-collector-types"
import axios from "axios"
import * as DateHolidays from "date-holidays"
import { Dictionary, groupBy, keyBy, maxBy, sortBy } from "lodash"
import { SnapshotsRepository } from "../snapshots/snapshots-repository"

interface ReporterRepo {
  repoId: string
  sumVulnerabilities: number
  responsible: string
}

interface ReporterDetailsData {
  timestamp: Date
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
            `${it.repoId}: ${it.sumVulnerabilitiesCurrent} (${formatDiffNumber(
              it.sumVulnerabilitiesCurrent - it.sumVulnerabilitiesPrevious,
            )})`,
        )
        .join("\n")
    )
  })

  const curVuln = sumVulnerabilities(details.current.repos)
  const prevVuln = sumVulnerabilities(details.previous.repos)

  return `Rapport over sårbarheter

Siste status: ${curVuln} (${formatDiffNumber(curVuln - prevVuln)})

${data.length > 0 ? data.join("\n\n") : "Alt OK"}

Siste datapunkt: ${formatTimestamp(details.current.timestamp)}
Sammenliknet mot: ${formatTimestamp(details.previous.timestamp)}

Detaljer: https://d2799m9v6pw1zy.cloudfront.net/`
}

function formatTimestamp(value: Date): string {
  return value.toISOString()
}

function formatDiffNumber(value: number): string {
  if (value == 0) return "ingen endring"
  if (value > 0) return `+${value}`
  return value.toString()
}

export async function getReporterDetails(
  snapshotsRepository: SnapshotsRepository,
): Promise<ReporterDetails | null> {
  const snapshotsList = await snapshotsRepository.list()

  const now = new Date()
  const cutoffTimestamp = calculateCutoffTimestamp(now)

  const currentSnapshot = maxBy(snapshotsList, (it) => it.timestamp)

  const previousSnapshot = maxBy(
    snapshotsList.filter(
      (it) => cutoffTimestamp.getTime() - it.timestamp.getTime() > 0,
    ),
    (it) => it.timestamp,
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

function isWeekend(date: Date) {
  // 0 = sunday
  // 6 = saturday
  return date.getUTCDay() == 0 || date.getUTCDay() == 6
}

export function calculateCutoffTimestamp(now: Date): Date {
  const holidays = new DateHolidays("NO")

  // The job runs 6 am UTC, so pick a time a bit after this.

  const cutoff = new Date(now)

  do {
    cutoff.setUTCDate(cutoff.getUTCDate() - 1)
    cutoff.setUTCHours(6, 30, 0, 0)
  } while (isWeekend(cutoff) || holidays.isHoliday(cutoff))

  return cutoff
}

async function getRepos(
  snapshotsRepository: SnapshotsRepository,
  timestamp: Date,
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
      cur.issueCountsBySeverity.high +
      cur.issueCountsBySeverity.medium +
      cur.issueCountsBySeverity.low,
    0,
  )
}

function sumGithubVuls(datapoint: MetricRepoSnapshot): number {
  return datapoint.github.vulnerabilityAlerts.filter(
    (it) => it.dismissReason == null,
  ).length
}

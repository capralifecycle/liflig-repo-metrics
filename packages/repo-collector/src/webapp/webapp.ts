import type {
  MetricsSnapshot,
  WebappData,
  Repo,
  Metrics,
} from "@liflig/repo-metrics-repo-collector-types"
import { groupBy, minBy } from "lodash-es"
import { Temporal } from "@js-temporal/polyfill"
import type { SnapshotsRepository } from "../snapshots/snapshots-repository"
import {
  calculateRenovateLastUpdateInDays,
  extractDependencyUpdatesFromIssue,
  isUpdateCategoryActionable,
} from "./renovate"

function sumSnykSeverities(projects: MetricsSnapshot["snyk"]["projects"]) {
  return projects.reduce(
    (acc, cur) => ({
      critical: acc.critical + (cur.issueCountsBySeverity.critical ?? 0),
      high: acc.high + cur.issueCountsBySeverity.high,
      medium: acc.medium + cur.issueCountsBySeverity.medium,
      low: acc.low + cur.issueCountsBySeverity.low,
    }),
    {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
  )
}

function extractPathFromSnykName(value: string): string {
  return value.replace(/^.+:/, "")
}

function snykProjectContainsVulnerability(
  project: MetricsSnapshot["snyk"]["projects"][0],
): boolean {
  return (
    (project.issueCountsBySeverity.high ?? 0) > 0 ||
    project.issueCountsBySeverity.high > 0 ||
    project.issueCountsBySeverity.medium > 0 ||
    project.issueCountsBySeverity.low > 0
  )
}

function convertDatapoint(datapoint: MetricsSnapshot): Metrics {
  const countsBySeverity = sumSnykSeverities(datapoint.snyk.projects)

  const renovateIssue = datapoint.github.renovateDependencyDashboardIssue

  const updateCategories =
    renovateIssue == null
      ? undefined
      : extractDependencyUpdatesFromIssue(renovateIssue.body)

  const lastUpdatedByRenovate = renovateIssue?.lastUpdatedByRenovate

  const renovateDaysSinceLastUpdate =
    lastUpdatedByRenovate == null
      ? null
      : calculateRenovateLastUpdateInDays(
          Temporal.Instant.from(datapoint.timestamp),
          Temporal.Instant.from(lastUpdatedByRenovate),
        )

  return {
    timestamp: datapoint.timestamp,
    github: {
      renovateDependencyDashboard: renovateIssue
        ? {
            issueNumber: renovateIssue.number,
            daysSinceLastUpdate: renovateDaysSinceLastUpdate,
          }
        : null,
      availableUpdates: updateCategories?.map((category) => ({
        categoryName: category.name,
        isActionable: isUpdateCategoryActionable(category.name),
        updates: category.updates,
      })),
      prs: datapoint.github.prs.map((pr) => ({
        number: pr.number,
        author: pr.author.login,
        title: pr.title,
        createdAt: pr.createdAt,
      })),
      vulnerabilityAlerts: datapoint.github.vulnerabilityAlerts
        .filter((it) =>
          it.state == null ? it.dismissReason == null : it.state === "OPEN",
        )
        .map((va) => ({
          vulnerableManifestPath: va.vulnerableManifestPath,
          severity: va.securityAdvisory?.severity,
          packageName:
            va.securityVulnerability?.package.name ?? "unknown-package",
        })),
    },
    snyk:
      datapoint.snyk.projects.length > 0
        ? {
            totalIssues:
              countsBySeverity.critical +
              countsBySeverity.high +
              countsBySeverity.medium +
              countsBySeverity.low,
            countsBySeverity,
            vulnerableProjects: datapoint.snyk.projects
              .filter(snykProjectContainsVulnerability)
              .map((it) => ({
                path: extractPathFromSnykName(it.name),
                browseUrl: it.browseUrl,
              })),
          }
        : undefined,
    sonarCloud: {
      enabled: !!datapoint.sonarCloud,
      testCoverage: datapoint.sonarCloud?.component?.measures?.find(
        (el) => el.metric === "coverage",
      )?.value,
    },
  }
}

export async function retrieveSnapshotsForWebappAggregation(
  snapshotsRepository: SnapshotsRepository,
): Promise<MetricsSnapshot[]> {
  console.log("Retrieving snapshots from snapshot repository")
  const allSnapshots = await snapshotsRepository.list()
  console.log("Snapshot repository returned ", allSnapshots.length, " items")

  console.log("Grouping snapshots by their timestamps")
  const allSnapshotsByTimestamp = groupBy(allSnapshots, (it) =>
    it.timestamp.toZonedDateTimeISO("UTC").toPlainDate().toString(),
  )
  console.log(
    `Grouped snapshots by timestamp into ${Object.keys(allSnapshotsByTimestamp).length}) groups`,
  )

  // Include all for last 15 days.
  // Include only daily first for older.

  const oldBefore = Temporal.Now.zonedDateTimeISO("UTC")
    .round({
      smallestUnit: "days",
      roundingMode: "trunc",
    })
    .subtract({ days: 15 })
    .toInstant()
  console.log("Cutoff date for old snapshots: ", oldBefore.toString())

  const snapshots: MetricsSnapshot[] = []

  console.log("Filtering snapshots, keeping the ones within cutoff date")
  for (const dailySnapshots of Object.values(allSnapshotsByTimestamp)) {
    const isOld =
      Temporal.Instant.compare(dailySnapshots[0].timestamp, oldBefore) < 0
    const toRead = isOld
      ? [minBy(dailySnapshots, (it) => it.timestamp.epochNanoseconds)!]
      : dailySnapshots

    for (const it of toRead) {
      snapshots.push(...(await snapshotsRepository.retrieve(it.timestamp)))
    }
  }
  console.log(`Returning ${snapshots.length} recent snapshots`)

  return snapshots
}

export function createWebappFriendlyFormat(
  snapshots: MetricsSnapshot[],
): WebappData {
  const byRepo = groupBy(snapshots, (it) => it.repoId)

  const lastSnapshotTimestamp = [...snapshots].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp),
  )[0]?.timestamp as string | undefined

  return {
    repos: Object.entries(byRepo).flatMap<Repo>(([repoId, items]) => {
      const itemsByTime = [...items].sort((a, b) =>
        a.timestamp.localeCompare(b.timestamp),
      )

      const lastItem = itemsByTime[itemsByTime.length - 1]

      // Only include the repo if it is included in the last snapshot.
      if (lastItem.timestamp !== lastSnapshotTimestamp) {
        return []
      }

      return [
        {
          repoId,
          lastDatapoint: convertDatapoint(lastItem),
          github: {
            orgName: lastItem.github.orgName,
            repoName: lastItem.github.repoName,
          },
          responsible: lastItem.responsible,
        },
      ]
    }),
  }
}

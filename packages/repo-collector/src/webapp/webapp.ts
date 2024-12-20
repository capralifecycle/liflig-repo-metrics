import type {
  MetricRepoSnapshot,
  WebappMetricData,
  WebappMetricDataRepo,
  WebappMetricDataRepoDatapoint,
  WebappStatsByFetchGroup,
} from "@liflig/repo-metrics-repo-collector-types"
import { groupBy, minBy, sumBy } from "lodash-es"
import { Temporal } from "@js-temporal/polyfill"
import type { SnapshotsRepository } from "../snapshots/snapshots-repository"
import {
  calculateRenovateLastUpdateInDays,
  extractDependencyUpdatesFromIssue,
  isUpdateCategoryActionable,
} from "./renovate"

function sumSnykSeverities(projects: MetricRepoSnapshot["snyk"]["projects"]) {
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
  project: MetricRepoSnapshot["snyk"]["projects"][0],
): boolean {
  return (
    (project.issueCountsBySeverity.high ?? 0) > 0 ||
    project.issueCountsBySeverity.high > 0 ||
    project.issueCountsBySeverity.medium > 0 ||
    project.issueCountsBySeverity.low > 0
  )
}

function convertDatapoint(
  datapoint: MetricRepoSnapshot,
): WebappMetricDataRepoDatapoint {
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

function getAvailableActionableUpdates(snapshot: MetricRepoSnapshot): number {
  return snapshot.github.renovateDependencyDashboardIssue == null
    ? 0
    : extractDependencyUpdatesFromIssue(
        snapshot.github.renovateDependencyDashboardIssue.body,
      ).flatMap((category) =>
        isUpdateCategoryActionable(category.name) ? category.updates : [],
      ).length
}

export async function retrieveSnapshotsForWebappAggregation(
  snapshotsRepository: SnapshotsRepository,
): Promise<MetricRepoSnapshot[]> {
  console.log("Retrieving and grouping snapshots from snapshot repository")
  const list = groupBy(await snapshotsRepository.list(), (it) =>
    it.timestamp.toZonedDateTimeISO("UTC").toPlainDate().toString(),
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

  const snapshots: MetricRepoSnapshot[] = []

  console.log("Fetching recent snapshots from S3")
  for (const dailySnapshots of Object.values(list)) {
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
  snapshots: MetricRepoSnapshot[],
): WebappMetricData {
  const byRepo = groupBy(snapshots, (it) => it.repoId)

  const byFetchGroup: WebappStatsByFetchGroup[] = Object.entries(
    groupBy(snapshots, (it) => it.timestamp),
  ).map<WebappStatsByFetchGroup>(([timestamp, items]) => ({
    timestamp,
    repos: items.map<WebappStatsByFetchGroup["repos"][0]>((it) => ({
      repoId: it.repoId,
      responsible: it.responsible ?? "Ukjent",
      updates: getAvailableActionableUpdates(it),
      githubVulnerabilities: it.github.vulnerabilityAlerts.filter((it) =>
        it.state == null ? it.dismissReason == null : it.state === "OPEN",
      ).length,
      snykVulnerabilities: sumBy(
        it.snyk.projects,
        (project) =>
          (project.issueCountsBySeverity.critical ?? 0) +
          project.issueCountsBySeverity.high +
          project.issueCountsBySeverity.medium +
          project.issueCountsBySeverity.low,
      ),
    })),
  }))

  const lastSnapshotTimestamp = [...snapshots].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp),
  )[0]?.timestamp as string | undefined

  return {
    byFetchGroup,
    // TODO: Rename to reposLatest or something?
    repos: Object.entries(byRepo).flatMap<WebappMetricDataRepo>(
      ([repoId, items]) => {
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
      },
    ),
  }
}

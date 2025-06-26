import { Temporal } from "@js-temporal/polyfill"
import type {
  Metrics,
  SnapshotData,
  SnapshotMetrics,
  WebappData,
} from "@liflig/repo-metrics-repo-collector-types"
import type { SnapshotsRepository } from "../snapshots/snapshots-repository"
import {
  calculateRenovateLastUpdateInDays,
  extractDependencyUpdatesFromIssue,
  isUpdateCategoryActionable,
} from "./renovate"

function sumSnykSeverities(projects: SnapshotMetrics["snyk"]["projects"]) {
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
  project: SnapshotMetrics["snyk"]["projects"][0],
): boolean {
  return (
    (project.issueCountsBySeverity.high ?? 0) > 0 ||
    project.issueCountsBySeverity.high > 0 ||
    project.issueCountsBySeverity.medium > 0 ||
    project.issueCountsBySeverity.low > 0
  )
}

/**
 * Create a repo metrics object from a repo snapshot for a single repository.
 * @param aggregationTimestamp Specifies the time of aggregation (now), and is used to calculate relative time for
 * Renovate, i.e., how long ago the last update was.
 * @param snapshotMetrics The snapshot metrics for a single repository.
 */
function mapSnapshotMetricToWebappMetrics(
  aggregationTimestamp: Temporal.Instant,
  snapshotMetrics: SnapshotMetrics,
): Metrics {
  const countsBySeverity = sumSnykSeverities(snapshotMetrics.snyk.projects)

  const renovateIssue = snapshotMetrics.github.renovateDependencyDashboardIssue

  const updateCategories =
    renovateIssue == null
      ? undefined
      : extractDependencyUpdatesFromIssue(renovateIssue.body)

  const lastUpdatedByRenovate = renovateIssue?.lastUpdatedByRenovate

  const renovateDaysSinceLastUpdate =
    lastUpdatedByRenovate == null
      ? null
      : calculateRenovateLastUpdateInDays(
          Temporal.Instant.from(aggregationTimestamp),
          Temporal.Instant.from(lastUpdatedByRenovate),
        )

  return {
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
      prs: snapshotMetrics.github.prs.map((pr) => ({
        number: pr.number,
        author: pr.author.login,
        title: pr.title,
        createdAt: pr.createdAt,
      })),
      vulnerabilityAlerts: snapshotMetrics.github.vulnerabilityAlerts
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
      snapshotMetrics.snyk.projects.length > 0
        ? {
            totalIssues:
              countsBySeverity.critical +
              countsBySeverity.high +
              countsBySeverity.medium +
              countsBySeverity.low,
            countsBySeverity,
            vulnerableProjects: snapshotMetrics.snyk.projects
              .filter(snykProjectContainsVulnerability)
              .map((it) => ({
                path: extractPathFromSnykName(it.name),
                browseUrl: it.browseUrl,
              })),
          }
        : undefined,
    sonarCloud: {
      enabled: !!snapshotMetrics.sonarCloud,
      testCoverage: snapshotMetrics.sonarCloud?.component?.measures?.find(
        (el) => el.metric === "coverage",
      )?.value,
    },
  }
}

/**
 * Retrieves repo snapshots from the provided snapshot repository.
 *
 * Snapshots are retrieved from the repository, filtered by their recency and
 * grouped by their timestamp. Only snapshots from the last 15 days are
 * included in the response.
 *
 * @param snapshotsRepository
 */
export async function retrieveSnapshotsForWebappAggregation(
  snapshotsRepository: SnapshotsRepository,
): Promise<SnapshotData> {
  console.log("Retrieving snapshot data from snapshot repository")
  const snapshotData = await snapshotsRepository.get()

  console.log("Snapshot data retrieved: ", {
    timestamp: snapshotData.timestamp,
    metricCount: snapshotData.metrics.length,
  })

  return snapshotData
}

/**
 * Map snapshot data to webapp-friendly format, retaining timestamps for
 * collection and aggregation.
 * @param snapshotData
 */
export function createWebappFriendlyFormat(
  snapshotData: SnapshotData,
): WebappData {
  const now = Temporal.Now.instant()
  const repos = snapshotData.metrics.map((metrics) => ({
    id: metrics.repoId,
    org: metrics.github.orgName,
    name: metrics.github.repoName,
    responsible: metrics.responsible,
    metrics: mapSnapshotMetricToWebappMetrics(now, metrics),
  }))

  return {
    collectedAt: snapshotData.timestamp,
    aggregatedAt: now.toString(),
    repos: repos,
  }
}

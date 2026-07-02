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
    },
    sonarCloud: {
      enabled: !!snapshotMetrics.sonarCloud,
      testCoverage: snapshotMetrics.sonarCloud?.component?.measures?.find(
        (el) => el.metric === "coverage",
      )?.value,
    },
    aikido: {
      enabled: snapshotMetrics.aikido?.enabled ?? false,
      repoId: snapshotMetrics.aikido?.repoId ?? null,
      ignoredCount: snapshotMetrics.aikido?.ignoredCount ?? 0,
      issues: (snapshotMetrics.aikido?.issueGroups ?? []).map((group) => ({
        groupId: group.groupId,
        severity: group.severity,
        type: group.type,
        title: group.title,
      })),
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
    customer: metrics.customer,
    system: metrics.system,
    metrics: mapSnapshotMetricToWebappMetrics(now, metrics),
  }))

  return {
    collectedAt: snapshotData.timestamp,
    aggregatedAt: now.toString(),
    repos: repos,
  }
}

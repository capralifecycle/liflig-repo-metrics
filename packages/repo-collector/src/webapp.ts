import {
  MetricRepoSnapshot,
  WebappMetricData,
  WebappMetricDataRepo,
  WebappMetricDataRepoDatapoint,
  WebappStatsByFetchGroup,
} from "@liflig/repo-metrics-repo-collector-types"
import { groupBy, sumBy } from "lodash"
import {
  calculateRenovateLastUpdateInDays,
  extractDependencyUpdatesFromIssue,
  isUpdateCategoryActionable,
} from "./renovate"

function sumSnykSeverities(projects: MetricRepoSnapshot["snyk"]["projects"]) {
  return projects.reduce(
    (acc, cur) => ({
      high: acc.high + cur.issueCountsBySeverity.high,
      medium: acc.high + cur.issueCountsBySeverity.medium,
      low: acc.high + cur.issueCountsBySeverity.low,
    }),
    {
      high: 0,
      medium: 0,
      low: 0,
    },
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
          new Date(datapoint.timestamp),
          new Date(lastUpdatedByRenovate),
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
      vulnerabilityAlerts: datapoint.github.vulnerabilityAlerts.map((va) => ({
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
              countsBySeverity.high +
              countsBySeverity.medium +
              countsBySeverity.low,
            countsBySeverity,
          }
        : undefined,
  }
}

function metricsForFetchGroup(snapshots: MetricRepoSnapshot[]) {
  const byResponsible = groupBy(snapshots, (it) => it.responsible ?? "Ukjent")

  return Object.entries(byResponsible).map(([responsible, items]) => ({
    responsible,
    availableActionableUpdates: sumBy(items, (it) =>
      it.github.renovateDependencyDashboardIssue == null
        ? 0
        : extractDependencyUpdatesFromIssue(
            it.github.renovateDependencyDashboardIssue.body,
          ).flatMap((category) =>
            isUpdateCategoryActionable(category.name) ? category.updates : [],
          ).length,
    ),
    github: {
      vulnerabilityAlerts: sumBy(
        items,
        (it) => it.github.vulnerabilityAlerts.length,
      ),
      prs: sumBy(items, (it) => it.github.prs.length),
    },
    snyk: {
      countsBySeverity: {
        high: sumBy(items, (it) =>
          sumBy(
            it.snyk.projects,
            (project) => project.issueCountsBySeverity.high,
          ),
        ),
        medium: sumBy(items, (it) =>
          sumBy(
            it.snyk.projects,
            (project) => project.issueCountsBySeverity.medium,
          ),
        ),
        low: sumBy(items, (it) =>
          sumBy(
            it.snyk.projects,
            (project) => project.issueCountsBySeverity.low,
          ),
        ),
      },
    },
  }))
}

export function createWebappFriendlyFormat(
  snapshots: MetricRepoSnapshot[],
): WebappMetricData {
  const byRepo = groupBy(snapshots, (it) => it.repoId)

  const byFetchGroup: WebappStatsByFetchGroup[] = Object.entries(
    groupBy(snapshots, (it) => it.timestamp),
  ).map(([timestamp, items]) => ({
    timestamp,
    byResponsible: metricsForFetchGroup(items),
  }))

  return {
    byFetchGroup,
    // TODO: Rename to reposLatest or something?
    repos: Object.entries(byRepo).map<WebappMetricDataRepo>(
      ([repoId, items]) => {
        const itemsByTime = [...items].sort((a, b) =>
          a.timestamp.localeCompare(b.timestamp),
        )

        const lastItem = itemsByTime[itemsByTime.length - 1]

        return {
          repoId,
          lastDatapoint: convertDatapoint(lastItem),
          github: {
            orgName: lastItem.github.orgName,
            repoName: lastItem.github.repoName,
          },
          responsible: lastItem.responsible,
        }
      },
    ),
  }
}

import {
  MetricRepoSnapshot,
  WebappMetricData,
  WebappMetricDataRepo,
  WebappMetricDataRepoDatapoint,
} from "@liflig/repo-metrics-repo-collector-types"
import { groupBy } from "lodash"
import { extractDependencyUpdatesFromIssue } from "./renovate"

function convertDatapoint(
  datapoint: MetricRepoSnapshot,
): WebappMetricDataRepoDatapoint {
  const countsBySeverity = datapoint.snyk.projects.reduce(
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

  return {
    timestamp: datapoint.timestamp,
    github: {
      availableUpdates:
        datapoint.github.renovateDependencyDashboardIssue == null
          ? undefined
          : extractDependencyUpdatesFromIssue(
              datapoint.github.renovateDependencyDashboardIssue.body,
            ),
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

export function createWebappFriendlyFormat(
  snapshots: MetricRepoSnapshot[],
): WebappMetricData {
  const byRepo = groupBy(snapshots, (it) => it.repoId)

  return {
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

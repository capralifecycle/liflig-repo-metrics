import {
  WebappMetricDataRepo,
  WebappMetricDataRepoDatapoint,
} from "@liflig/repo-metrics-repo-collector-types"
import * as React from "react"
import { PrColumnDetails } from "./PrColumnDetails"
import { Column } from "./Table"

export const repoColumns = (props: {
  showPrList: boolean
  showDepList: boolean
  showVulList: boolean
  showOrgName: boolean
  showRenovateDays: boolean
}): Column<WebappMetricDataRepo>[] => {
  const {
    showPrList,
    showDepList,
    showVulList,
    showOrgName,
    showRenovateDays,
  } = props
  return [
    {
      header: "Repo",
      sortOn: (data) => {
        const [_, repoName] = data.repoId.split("/")
        return repoName.toLowerCase()
      },
      render: (data) => {
        const [orgName, repoName] = data.repoId.split("/")
        return (
          <a href={repoBaseUrl(data)}>
            {showOrgName && <span className="repo-org">{orgName}/</span>}
            <span className="repo-name">{repoName}</span>
          </a>
        )
      },
    },
    {
      header: "Oppdateringer til behandling",
      sortOn: (data) =>
        data.lastDatapoint.github.availableUpdates
          ?.flatMap((category) =>
            category.updates.map((it) => ({
              name: it.name,
              isActionable: category.isActionable,
              categoryName: category.categoryName,
              toVersion: it.toVersion,
            })),
          )
          .filter((it) => it.isActionable).length,
      render: (data) => {
        const renovateDashboad =
          data.lastDatapoint.github.renovateDependencyDashboard

        const renovateEnabled =
          data.lastDatapoint.github.availableUpdates != null
        const availableUpdates = (
          data.lastDatapoint.github.availableUpdates ?? []
        ).flatMap((category) =>
          category.updates.map((it) => ({
            name: it.name,
            isActionable: category.isActionable,
            categoryName: category.categoryName,
            toVersion: it.toVersion,
          })),
        )
        const actionableUpdates = availableUpdates.filter(
          (it) => it.isActionable,
        ).length

        return (
          <>
            {renovateDashboad?.daysSinceLastUpdate != null &&
              (showRenovateDays ||
                renovateDashboad.daysSinceLastUpdate >= 20) && (
                <div
                  className={
                    renovateDashboad.daysSinceLastUpdate >= 20
                      ? "renovate-old"
                      : undefined
                  }
                >
                  <>
                    Sist oppdatert {renovateDashboad.daysSinceLastUpdate} dager
                    siden
                  </>
                </div>
              )}
            {!renovateEnabled ? (
              <span className="renovate-missing">Mangler Renovate</span>
            ) : (
              <>
                {actionableUpdates === 0 ? (
                  <span className="renovate-ok">
                    <MaybeRenovateLink data={data}>Ingen</MaybeRenovateLink>
                    <RenovateLogsLink repoId={data.repoId} />
                  </span>
                ) : (
                  <>
                    <MaybeRenovateLink data={data}>
                      <b>{actionableUpdates}</b>
                    </MaybeRenovateLink>
                    <RenovateLogsLink repoId={data.repoId} />
                  </>
                )}
                {showDepList && (
                  <ul>
                    {availableUpdates.map((available, i) => (
                      <li
                        key={i}
                        style={available.isActionable ? {} : { color: "#AAA" }}
                      >
                        {available.name} ({available.toVersion}) (
                        {available.categoryName})
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </>
        )
      },
    },
    {
      header: "Åpne PRs (bots)",
      sortOn: (data) =>
        data.lastDatapoint.github.prs.filter((it) => isBotPr(it)).length,
      render: (data) => {
        return (
          <PrColumnDetails
            prs={data.lastDatapoint.github.prs.filter((it) => isBotPr(it))}
            repoBaseUrl={repoBaseUrl(data)}
            showPrList={showPrList}
          />
        )
      },
    },
    {
      header: "Åpne PRs (ikke bots)",
      sortOn: (data) =>
        data.lastDatapoint.github.prs.filter((it) => !isBotPr(it)).length,
      render: (data) => {
        return (
          <PrColumnDetails
            prs={data.lastDatapoint.github.prs.filter((it) => !isBotPr(it))}
            repoBaseUrl={repoBaseUrl(data)}
            showPrList={showPrList}
          />
        )
      },
    },
    {
      header: "Sårbarheter (GitHub)",
      sortOn: (data) => data.lastDatapoint.github.vulnerabilityAlerts.length,
      render: (data) => {
        const githubVulAlerts = data.lastDatapoint.github.vulnerabilityAlerts
        return githubVulAlerts.length === 0 ? (
          <span style={{ color: "var(--color-success)" }}>Ingen</span>
        ) : (
          <>
            <a
              href={`${repoBaseUrl(data)}/security/dependabot`}
              className="dependabot-alerts-link"
            >
              <b>{githubVulAlerts.length}</b>
            </a>
            {showVulList && (
              <ul>
                {githubVulAlerts.map((vul, idx) => (
                  <li key={idx}>
                    {vul.packageName} ({vul.severity})
                  </li>
                ))}
              </ul>
            )}
          </>
        )
      },
    },
    {
      header: "Sårbarheter (Snyk)",
      sortOn: (data) => data.lastDatapoint.snyk?.totalIssues,
      render: (data) => {
        const snyk = data.lastDatapoint.snyk
        return snyk == null ? (
          <>Mangler Snyk</>
        ) : snyk.totalIssues === 0 ? (
          <span style={{ color: "var(--color-success)" }}>Ingen</span>
        ) : (
          <>
            <SnykItem
              value={snyk.countsBySeverity.critical ?? 0}
              type="critical"
            />
            <span style={{ color: "#AAA" }}> / </span>
            <SnykItem value={snyk.countsBySeverity.high} type="high" />
            <span style={{ color: "#AAA" }}> / </span>
            <SnykItem value={snyk.countsBySeverity.medium} type="medium" />
            <span style={{ color: "#AAA" }}> / </span>
            <SnykItem value={snyk.countsBySeverity.low} type="low" />
            {showVulList &&
              snyk.vulnerableProjects.map((it) => (
                <div key={it.path}>
                  <a href={it.browseUrl}>{it.path}</a>
                </div>
              ))}
          </>
        )
      },
    },
    {
      header: "Testdekning (%) (SonarCloud)",
      sortOn: (data) =>
        data.lastDatapoint.sonarCloud.testCoverage
          ? Number(data.lastDatapoint.sonarCloud.testCoverage)
          : undefined,
      render: (data) => {
        return data.lastDatapoint.sonarCloud.testCoverage ? (
          <span
            className="test-coverage"
            style={sonarCloudTestCoverageStyle(
              data.lastDatapoint.sonarCloud.testCoverage,
            )}
          >
            {data.lastDatapoint.sonarCloud.testCoverage}
          </span>
        ) : (
          <>Mangler testdekning</>
        )
      },
    },
  ]
}

function isBotPr(pr: WebappMetricDataRepoDatapoint["github"]["prs"][0]) {
  return (
    ["dependabot", "renovate"].includes(pr.author) ||
    pr.title.startsWith("[Snyk]")
  )
}

export function isActionableRepo(repo: WebappMetricDataRepoDatapoint): boolean {
  return (
    (repo.github.availableUpdates ?? []).filter((it) => it.isActionable)
      .length > 0 ||
    repo.github.prs.filter((it) => isBotPr(it)).length > 0 ||
    isVulnerableRepo(repo)
  )
}

export function isVulnerableRepo(repo: WebappMetricDataRepoDatapoint): boolean {
  return (
    repo.github.vulnerabilityAlerts.length > 0 ||
    (repo.snyk?.totalIssues ?? 0) > 0
  )
}

interface Props {
  data: WebappMetricDataRepo
  showPrList: boolean
  showDepList: boolean
  showVulList: boolean
  showRenovateDays: boolean
  showOrgName: boolean
}

type SnykType = "critical" | "high" | "medium" | "low"

function snykStyle(type: SnykType): React.CSSProperties {
  switch (type) {
    case "low":
      return {
        color: "orange",
      }
    case "medium":
      return {
        color: "red",
      }
    case "high":
      return {
        color: "red",
        fontWeight: "bold",
      }
    case "critical":
      return {
        color: "red",
        fontWeight: "bold",
      }
  }
}

function sonarCloudTestCoverageStyle(coverage: string): React.CSSProperties {
  if (parseInt(coverage) > 70) {
    return {
      color: "green",
    }
  } else if (parseInt(coverage) > 45) {
    return {
      color: "darkgoldenrod",
    }
  } else {
    return {
      color: "red",
    }
  }
}

const SnykItem: React.FC<{
  value: number
  type: SnykType
}> = ({ value, type }) => (
  <span title={type}>
    {value === 0 ? (
      <span style={{ color: "#AAA" }}>{value}</span>
    ) : (
      <span style={snykStyle(type)}>{value}</span>
    )}
  </span>
)

const repoBaseUrl = (data: WebappMetricDataRepo) =>
  `https://github.com/${data.github.orgName}/${data.github.repoName}`

const RenovateLogsLink: React.FC<{ repoId: string }> = ({ repoId }) => (
  <a
    href={`https://app.renovatebot.com/dashboard#github/${encodeURI(repoId)}`}
    className="renovate-logs-link"
  >
    logs
  </a>
)

const MaybeRenovateLink: React.FC<
  React.PropsWithChildren & {
    data: WebappMetricDataRepo
  }
> = ({ children, data }) => {
  const renovateDashboad = data.lastDatapoint.github.renovateDependencyDashboard
  return renovateDashboad != null ? (
    <a
      href={issueUrl(data, renovateDashboad.issueNumber)}
      className="renovate-dashboard-link"
    >
      {children}
    </a>
  ) : (
    <>{children}</>
  )
}

function issueUrl(data: WebappMetricDataRepo, issueNumber: number) {
  return `${repoBaseUrl(data)}/issues/${issueNumber}`
}

import type { Metrics, Repo } from "@liflig/repo-metrics-repo-collector-types"
import type * as React from "react"
import { PrColumnDetails } from "./PrColumnDetails"
import type { Column } from "./Table"

export const repoColumns = (props: {
  showPrList: boolean
  showDepList: boolean
  showVulList: boolean
  showOrgName: boolean
  showRenovateDays: boolean
}): Column<Repo>[] => {
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
      sortOn: (repo) => {
        return repo.name.toLowerCase()
      },
      render: (repo) => {
        return (
          <a href={repoBaseUrl(repo)}>
            {showOrgName && <span className="repo-org">{repo.org}/</span>}
            <span className="repo-name">{repo.name}</span>
          </a>
        )
      },
    },
    {
      header: "Oppdateringer til behandling",
      sortOn: (repo) =>
        repo.metrics.github.availableUpdates
          ?.flatMap((category) =>
            category.updates.map((it) => ({
              name: it.name,
              isActionable: category.isActionable,
              categoryName: category.categoryName,
              toVersion: it.toVersion,
            })),
          )
          .filter((it) => it.isActionable).length,
      render: (repo) => {
        const renovateDashboad = repo.metrics.github.renovateDependencyDashboard

        const renovateEnabled = repo.metrics.github.availableUpdates != null
        const availableUpdates = (
          repo.metrics.github.availableUpdates ?? []
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
                    <MaybeRenovateLink repo={repo}>Ingen</MaybeRenovateLink>
                    <RenovateLogsLink repoId={repo.id} />
                  </span>
                ) : (
                  <>
                    <MaybeRenovateLink repo={repo}>
                      <b>{actionableUpdates}</b>
                    </MaybeRenovateLink>
                    <RenovateLogsLink repoId={repo.id} />
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
      sortOn: (repo) =>
        repo.metrics.github.prs.filter((it) => isBotPr(it)).length,
      render: (repo) => {
        return (
          <PrColumnDetails
            prs={repo.metrics.github.prs.filter((it) => isBotPr(it))}
            repoBaseUrl={repoBaseUrl(repo)}
            showPrList={showPrList}
          />
        )
      },
    },
    {
      header: "Åpne PRs (ikke bots)",
      sortOn: (repo) =>
        repo.metrics.github.prs.filter((it) => !isBotPr(it)).length,
      render: (repo) => {
        return (
          <PrColumnDetails
            prs={repo.metrics.github.prs.filter((it) => !isBotPr(it))}
            repoBaseUrl={repoBaseUrl(repo)}
            showPrList={showPrList}
          />
        )
      },
    },
    {
      header: "Sårbarheter (GitHub)",
      sortOn: (repo) => repo.metrics.github.vulnerabilityAlerts.length,
      render: (repo) => {
        const githubVulAlerts = repo.metrics.github.vulnerabilityAlerts
        return githubVulAlerts.length === 0 ? (
          <span style={{ color: "var(--color-success)" }}>Ingen</span>
        ) : (
          <>
            <a
              href={`${repoBaseUrl(repo)}/security/dependabot`}
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
      sortOn: (repo) => repo.metrics.snyk?.totalIssues,
      render: (repo) => {
        const snyk = repo.metrics.snyk
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
      sortOn: (repo) =>
        repo.metrics.sonarCloud.testCoverage
          ? Number(repo.metrics.sonarCloud.testCoverage)
          : undefined,
      render: (repo) => {
        return repo.metrics.sonarCloud.testCoverage ? (
          <span
            className="test-coverage"
            style={sonarCloudTestCoverageStyle(
              repo.metrics.sonarCloud.testCoverage,
            )}
          >
            {repo.metrics.sonarCloud.testCoverage}
          </span>
        ) : (
          <>Mangler testdekning</>
        )
      },
    },
  ]
}

function isBotPr(pr: Metrics["github"]["prs"][0]) {
  return (
    ["dependabot", "renovate"].includes(pr.author) ||
    pr.title.startsWith("[Snyk]")
  )
}

export function isActionableRepo(repo: Metrics): boolean {
  return (
    (repo.github.availableUpdates ?? []).filter((it) => it.isActionable)
      .length > 0 ||
    repo.github.prs.filter((it) => isBotPr(it)).length > 0 ||
    isVulnerableRepo(repo)
  )
}

export function isVulnerableRepo(repo: Metrics): boolean {
  return (
    repo.github.vulnerabilityAlerts.length > 0 ||
    (repo.snyk?.totalIssues ?? 0) > 0
  )
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
  if (Number.parseInt(coverage) > 70) {
    return {
      color: "green",
    }
  }
  if (Number.parseInt(coverage) > 45) {
    return {
      color: "darkgoldenrod",
    }
  }
  return {
    color: "red",
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

const repoBaseUrl = (repo: Repo) =>
  `https://github.com/${repo.org}/${repo.name}`

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
    repo: Repo
  }
> = ({ children, repo }) => {
  const renovateDashboad = repo.metrics.github.renovateDependencyDashboard
  return renovateDashboad != null ? (
    <a
      href={issueUrl(repo, renovateDashboad.issueNumber)}
      className="renovate-dashboard-link"
    >
      {children}
    </a>
  ) : (
    <>{children}</>
  )
}

function issueUrl(repo: Repo, issueNumber: number) {
  return `${repoBaseUrl(repo)}/issues/${issueNumber}`
}

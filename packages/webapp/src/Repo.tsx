import type { Metrics, Repo } from "@liflig/repo-metrics-repo-collector-types"
import type * as React from "react"
import { Highlight } from "./Highlight"
import { GitHubIcon, PrIcon, RenovateIcon, SecurityIcon, SnykIcon, SonarCloudIcon } from "./Icons"
import { PrColumnDetails } from "./PrColumnDetails"
import { isBotPr } from "./prUtils"
import type { Column } from "./Table"

export const repoColumns = (props: {
  showPrList: boolean
  showBotPrList: boolean
  showDepList: boolean
  showVulGithubList: boolean
  showVulSnykList: boolean
  showOrgName: boolean
  showRenovateDays: boolean
  filterRepoName: string
  filterUpdateName: string
  filterVulName: string
}): Column<Repo>[] => {
  const {
    showPrList,
    showBotPrList,
    showDepList,
    showVulGithubList,
    showVulSnykList,
    showOrgName,
    showRenovateDays,
    filterRepoName,
    filterUpdateName,
    filterVulName,
  } = props
  return [
    {
      header: "Repo",
      headerIcon: <GitHubIcon />,
      width: "18%",
      sortOn: (repo) => {
        return repo.name.toLowerCase()
      },
      render: (repo, _isExpanded) => {
        return (
          <a href={repoBaseUrl(repo)}>
            {showOrgName && (
              <span className="repo-org"><Highlight text={repo.org} search={filterRepoName} />/</span>
            )}
            <span className="repo-name"><Highlight text={repo.name} search={filterRepoName} /></span>
          </a>
        )
      },
    },
    {
      header: "Avhengigheter",
      subheader: "Renovate",
      headerIcon: <RenovateIcon />,
      width: "22%",
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
      render: (repo, isExpanded) => {
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
                  className={`renovate-days ${
                    renovateDashboad.daysSinceLastUpdate >= 20
                      ? "renovate-old"
                      : ""
                  }`}
                >
                  Sist oppdatert {renovateDashboad.daysSinceLastUpdate} dager
                  siden
                </div>
              )}
            {!renovateEnabled ? (
              <span className="state-missing">Mangler Renovate</span>
            ) : (showDepList || isExpanded) && availableUpdates.length > 0 ? (
              <ul className="detail-list">
                {availableUpdates.map((available, i) => (
                  <li
                    key={i}
                    className={`detail-item ${!available.isActionable ? "detail-item-muted" : ""}`}
                  >
                    <span className="detail-index">{i + 1}</span>
                    {available.name}
                    <span className="detail-meta">
                      {" "}{available.toVersion} · {available.categoryName}
                    </span>
                  </li>
                ))}
              </ul>
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
              </>
            )}
          </>
        )
      },
    },
    {
      header: "PRs",
      headerIcon: <PrIcon />,
      width: "22%",
      sortOn: (repo) =>
        repo.metrics.github.prs.filter((it) => !isBotPr(it)).length,
      render: (repo, isExpanded) => {
        return (
          <PrColumnDetails
            prs={repo.metrics.github.prs.filter((it) => !isBotPr(it))}
            repoBaseUrl={repoBaseUrl(repo)}
            showPrList={showPrList || isExpanded}
            filterUpdateName={filterUpdateName}
          />
        )
      },
    },
    {
      header: "Bot PR",
      headerIcon: <PrIcon />,
      width: "18%",
      sortOn: (repo) =>
        repo.metrics.github.prs.filter((it) => isBotPr(it)).length,
      render: (repo, isExpanded) => {
        return (
          <PrColumnDetails
            prs={repo.metrics.github.prs.filter((it) => isBotPr(it))}
            repoBaseUrl={repoBaseUrl(repo)}
            showPrList={showBotPrList || isExpanded}
            filterUpdateName={filterUpdateName}
          />
        )
      },
    },
    {
      header: "Sårbarheter",
      subheader: "GitHub",
      headerIcon: <SecurityIcon />,
      width: "9%",
      sortOn: (repo) => repo.metrics.github.vulnerabilityAlerts.length,
      render: (repo, isExpanded) => {
        const githubVulAlerts = repo.metrics.github.vulnerabilityAlerts
        const dependabotUrl = `${repoBaseUrl(repo)}/security/dependabot`
        if (githubVulAlerts.length === 0) {
          return <a href={dependabotUrl} className="state-ok">Ingen</a>
        }
        const hasVulSearch = filterVulName !== ""
        const matchingAlerts = hasVulSearch
          ? githubVulAlerts.filter((a) =>
              a.packageName.toLowerCase().includes(filterVulName.toLowerCase()),
            )
          : []
        const showDetails = showVulGithubList || isExpanded || matchingAlerts.length > 0
        if (!showDetails) {
          return (
            <a href={dependabotUrl}>
              <b>{githubVulAlerts.length}</b>
            </a>
          )
        }
        const alertsToGroup = showVulGithubList || isExpanded ? githubVulAlerts : matchingAlerts
        const grouped = groupVulnsByPackage(alertsToGroup)
        return (
          <ul className="detail-list">
            {grouped.map((group, idx) => (
              <li key={idx} className="detail-item">
                <span className="detail-index">{idx + 1}</span>
                <a href={dependabotUrl}><Highlight text={group.packageName} search={filterVulName} /></a>
                {group.count > 1 && (
                  <span className="detail-meta">&times;{group.count}</span>
                )}
                {group.highestSeverity && (
                  <span className={`detail-severity severity-${group.highestSeverity.toLowerCase()}`}>
                    {group.highestSeverity}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )
      },
    },
    {
      header: "Sårbarheter",
      subheader: "Snyk (C/H/M/L)",
      subheaderTitle: "Critical / High / Medium / Low",
      headerIcon: <SnykIcon />,
      width: "7%",
      sortOn: (repo) => repo.metrics.snyk?.totalIssues,
      render: (repo, isExpanded) => {
        const snyk = repo.metrics.snyk
        if (snyk == null) return <span className="state-missing">Mangler Snyk</span>
        if (snyk.totalIssues === 0) return <span className="state-ok">Ingen</span>

        const hasVulSearch = filterVulName !== ""
        const matchingProjects = hasVulSearch
          ? snyk.vulnerableProjects.filter((p) =>
              p.path.toLowerCase().includes(filterVulName.toLowerCase()),
            )
          : []
        const showDetails = showVulSnykList || isExpanded || matchingProjects.length > 0
        const projectsToShow = showVulSnykList || isExpanded
          ? snyk.vulnerableProjects
          : matchingProjects

        return showDetails && projectsToShow.length > 0 ? (
          <ul className="snyk-project-list">
            {projectsToShow.map((it, idx) => (
              <li key={it.path} className="snyk-project-item">
                <span className="detail-index">{idx + 1}</span>
                <a href={it.browseUrl}><Highlight text={it.path} search={filterVulName} /></a>
              </li>
            ))}
          </ul>
        ) : (
          <span className="snyk-counts">
            <SnykItem
              value={snyk.countsBySeverity.critical ?? 0}
              type="critical"
            />
            <span className="snyk-sep">/</span>
            <SnykItem value={snyk.countsBySeverity.high} type="high" />
            <span className="snyk-sep">/</span>
            <SnykItem value={snyk.countsBySeverity.medium} type="medium" />
            <span className="snyk-sep">/</span>
            <SnykItem value={snyk.countsBySeverity.low} type="low" />
          </span>
        )
      },
    },
    {
      header: "Testdekning",
      subheader: "SonarCloud",
      headerIcon: <SonarCloudIcon />,
      width: "4%",
      sortOn: (repo) =>
        repo.metrics.sonarCloud.testCoverage
          ? Number(repo.metrics.sonarCloud.testCoverage)
          : undefined,
      render: (repo, _isExpanded) => {
        return repo.metrics.sonarCloud.testCoverage ? (
          <span
            className={`test-coverage ${coverageClass(repo.metrics.sonarCloud.testCoverage)}`}
          >
            {repo.metrics.sonarCloud.testCoverage}
          </span>
        ) : (
          <span className="state-missing">Mangler testdekning</span>
        )
      },
    },
  ]
}

const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MODERATE", "LOW"] as const

type Severity = "CRITICAL" | "HIGH" | "LOW" | "MODERATE"

function groupVulnsByPackage(
  alerts: { packageName: string; severity?: Severity }[],
) {
  const map = new Map<string, { count: number; highestSeverity?: Severity }>()
  for (const alert of alerts) {
    const existing = map.get(alert.packageName)
    if (existing) {
      existing.count++
      if (alert.severity && (!existing.highestSeverity ||
        SEVERITY_ORDER.indexOf(alert.severity) < SEVERITY_ORDER.indexOf(existing.highestSeverity))) {
        existing.highestSeverity = alert.severity
      }
    } else {
      map.set(alert.packageName, { count: 1, highestSeverity: alert.severity })
    }
  }
  return [...map.entries()]
    .map(([packageName, { count, highestSeverity }]) => ({ packageName, count, highestSeverity }))
    .sort((a, b) => {
      const ai = a.highestSeverity ? SEVERITY_ORDER.indexOf(a.highestSeverity) : 999
      const bi = b.highestSeverity ? SEVERITY_ORDER.indexOf(b.highestSeverity) : 999
      return ai - bi || a.packageName.localeCompare(b.packageName)
    })
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
      return { color: "var(--color-snyk-low)" }
    case "medium":
      return { color: "var(--color-snyk-medium)" }
    case "high":
      return { color: "var(--color-snyk-high)", fontWeight: "bold" }
    case "critical":
      return { color: "var(--color-snyk-critical)", fontWeight: "bold" }
  }
}

function coverageClass(coverage: string): string {
  const val = Number.parseInt(coverage, 10)
  if (val > 70) return "coverage-good"
  if (val > 45) return "coverage-mid"
  return "coverage-low"
}

const SnykItem: React.FC<{
  value: number
  type: SnykType
}> = ({ value, type }) => (
  <span title={type}>
    {value === 0 ? (
      <span style={{ color: "var(--color-snyk-zero)" }}>{value}</span>
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
    children
  )
}

function issueUrl(repo: Repo, issueNumber: number) {
  return `${repoBaseUrl(repo)}/issues/${issueNumber}`
}

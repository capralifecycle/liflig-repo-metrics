import type {
  AikidoSeverity,
  Metrics,
  Repo,
} from "@liflig/repo-metrics-repo-collector-types"
import type * as React from "react"
import { Highlight } from "./Highlight"
import { GitHubIcon, PrIcon, RenovateIcon, SecurityIcon, SonarCloudIcon } from "./Icons"
import { PrColumnDetails } from "./PrColumnDetails"
import { isBotPr } from "./prUtils"
import type { Column } from "./Table"

export const repoColumns = (props: {
  showPrList: boolean
  showBotPrList: boolean
  showDepList: boolean
  showVulAikidoList: boolean
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
    showVulAikidoList,
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
              <span className="state-missing" title="Ingen data">—</span>
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
      subheader: "Aikido",
      headerIcon: <SecurityIcon />,
      width: "9%",
      sortOn: (repo) => aikidoSortValue(repo.metrics.aikido.issues),
      render: (repo, isExpanded) => {
        const aikido = repo.metrics.aikido
        if (!aikido.enabled) {
          return <span className="state-missing" title="Ingen data">—</span>
        }
        if (aikido.issues.length === 0 && aikido.ignoredCount === 0) {
          return <span className="state-ok">Ingen</span>
        }

        const summary = (
          <AikidoSeverityCounts
            issues={aikido.issues}
            ignoredCount={aikido.ignoredCount}
          />
        )

        const hasVulSearch = filterVulName !== ""
        const matchingIssues = hasVulSearch
          ? aikido.issues.filter((i) =>
              i.title.toLowerCase().includes(filterVulName.toLowerCase()),
            )
          : []
        const showDetails =
          showVulAikidoList || isExpanded || matchingIssues.length > 0
        if (!showDetails) {
          return summary
        }

        const listed =
          showVulAikidoList || isExpanded ? aikido.issues : matchingIssues
        const sorted = [...listed].sort(
          (a, b) =>
            AIKIDO_SEVERITY_ORDER.indexOf(a.severity) -
              AIKIDO_SEVERITY_ORDER.indexOf(b.severity) ||
            a.title.localeCompare(b.title),
        )
        return (
          <>
            {summary}
            <ul className="detail-list">
              {sorted.map((issue, idx) => (
                <li key={idx} className="detail-item">
                  <span className="detail-index">{idx + 1}</span>
                  <a
                    href={aikidoIssueUrl(aikido.repoId, issue.groupId)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Highlight text={issue.title} search={filterVulName} />
                  </a>
                  <span
                    className={`detail-severity severity-${issue.severity}`}
                  >
                    {issue.severity}
                  </span>
                </li>
              ))}
            </ul>
          </>
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
          <span className="state-missing" title="Ingen data">—</span>
        )
      },
    },
  ]
}

const AIKIDO_SEVERITY_ORDER: AikidoSeverity[] = [
  "critical",
  "high",
  "medium",
  "low",
]

// Deep link to an issue group in the Aikido dashboard. Prefer the repo-scoped
// view (opens the issue in the repo's detail page); fall back to the queue.
function aikidoIssueUrl(repoId: number | null, groupId: number): string {
  return repoId != null
    ? `https://app.aikido.dev/repositories/${repoId}?sidebarIssue=${groupId}`
    : `https://app.aikido.dev/queue?sidebarIssue=${groupId}`
}

type AikidoIssue = Metrics["aikido"]["issues"][number]

function aikidoSeverityBuckets(issues: AikidoIssue[]): Record<AikidoSeverity, number> {
  const counts: Record<AikidoSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  }
  for (const issue of issues) counts[issue.severity]++
  return counts
}

// Severity-weighted sort key so critical-heavy repos rank above low-severity ones.
function aikidoSortValue(issues: AikidoIssue[]): number {
  const c = aikidoSeverityBuckets(issues)
  return c.critical * 1000 + c.high * 100 + c.medium * 10 + c.low
}

const AIKIDO_COUNT_META: {
  key: AikidoSeverity
  cls: string
  label: string
}[] = [
  { key: "critical", cls: "sev-c", label: "Kritisk" },
  { key: "high", cls: "sev-h", label: "Høy" },
  { key: "medium", cls: "sev-m", label: "Medium" },
  { key: "low", cls: "sev-l", label: "Lav" },
]

// Colorized per-severity counts (critical/high/medium/low) plus a muted count
// of ignored issues, mirroring how Aikido presents a repo's issues.
function AikidoSeverityCounts({
  issues,
  ignoredCount,
}: {
  issues: AikidoIssue[]
  ignoredCount: number
}) {
  const counts = aikidoSeverityBuckets(issues)
  return (
    <span className="aikido-counts">
      {AIKIDO_COUNT_META.map((meta) =>
        counts[meta.key] > 0 ? (
          <span key={meta.key} className={meta.cls} title={meta.label}>
            {counts[meta.key]}
          </span>
        ) : null,
      )}
      {ignoredCount > 0 && (
        <span className="sev-i" title="Ignorert">
          {ignoredCount}
        </span>
      )}
    </span>
  )
}

export function isActionableRepo(repo: Metrics): boolean {
  return (
    (repo.github.availableUpdates ?? []).filter((it) => it.isActionable)
      .length > 0 ||
    repo.github.prs.filter((it) => isBotPr(it)).length > 0
  )
}

function coverageClass(coverage: string): string {
  const val = Number.parseInt(coverage, 10)
  if (val > 70) return "coverage-good"
  if (val > 45) return "coverage-mid"
  return "coverage-low"
}

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

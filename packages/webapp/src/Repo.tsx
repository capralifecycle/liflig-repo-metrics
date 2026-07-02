import type {
  AikidoSeverity,
  Metrics,
  Repo,
} from "@liflig/repo-metrics-repo-collector-types"
import { Highlight } from "./Highlight"
import { AikidoIcon, GitHubIcon, PrIcon, SonarCloudIcon } from "./Icons"
import { PrColumnDetails } from "./PrColumnDetails"
import { isBotPr } from "./prUtils"
import type { Column } from "./Table"

export const repoColumns = (props: {
  showPrList: boolean
  showBotPrList: boolean
  showVulAikidoList: boolean
  showOrgName: boolean
  filterRepoName: string
  filterUpdateName: string
  filterVulName: string
  /**
   * Compact layout used while the detail sidebar is open and the table is
   * squeezed to ~60% width: wider columns, no header icons, and a shorter
   * coverage header.
   */
  compact?: boolean
}): Column<Repo>[] => {
  const {
    showPrList,
    showBotPrList,
    showVulAikidoList,
    showOrgName,
    filterRepoName,
    filterUpdateName,
    filterVulName,
    compact = false,
  } = props
  const columns: Column<Repo>[] = [
    {
      header: "Repo",
      headerIcon: <GitHubIcon />,
      width: compact ? "36%" : "18%",
      sortOn: (repo) => {
        return repo.name.toLowerCase()
      },
      render: (repo, _isExpanded) => {
        return (
          <span className="repo-link" title={repo.name}>
            {showOrgName && (
              <span className="repo-org"><Highlight text={repo.org} search={filterRepoName} />/</span>
            )}
            <span className="repo-name"><Highlight text={repo.name} search={filterRepoName} /></span>
          </span>
        )
      },
    },
    {
      header: "PRs",
      headerIcon: <PrIcon />,
      width: compact ? "13%" : "22%",
      align: "right",
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
      width: compact ? "15%" : "18%",
      align: "right",
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
      header: "Vulns",
      subheader: "Aikido",
      headerIcon: <AikidoIcon />,
      width: compact ? "17%" : "9%",
      align: "right",
      sortOn: (repo) => aikidoSortValue(repo.metrics.aikido.issues),
      render: (repo, isExpanded) => {
        const aikido = repo.metrics.aikido
        if (!aikido.enabled) {
          return <span className="state-missing" title="No data">—</span>
        }
        if (aikido.issues.length === 0 && aikido.ignoredCount === 0) {
          return null
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
      header: "Coverage",
      subheader: "SonarCloud",
      headerIcon: <SonarCloudIcon />,
      width: compact ? "19%" : "4%",
      align: "right",
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
          <span className="coverage-missing">missing</span>
        )
      },
    },
  ]

  return columns
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
  { key: "critical", cls: "sev-c", label: "Critical" },
  { key: "high", cls: "sev-h", label: "High" },
  { key: "medium", cls: "sev-m", label: "Medium" },
  { key: "low", cls: "sev-l", label: "Low" },
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

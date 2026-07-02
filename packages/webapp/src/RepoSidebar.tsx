import type {
  AikidoSeverity,
  Repo,
} from "@liflig/repo-metrics-repo-collector-types"
import * as React from "react"
import { createPortal } from "react-dom"
import { AikidoIcon, GitHubIcon, PrIcon, RenovateIcon, SonarCloudIcon } from "./Icons"
import { isBotPr } from "./prUtils"

/**
 * Repo detail panel shown on the right of the table. Selecting a repo fills
 * this panel with the full detail (all updates, PRs, Aikido issues) that does
 * not fit inline. Rendered into the `#detail-panel` flex slot so it shrinks the
 * rows rather than overlaying them.
 */

const AIKIDO_SEVERITY_ORDER: AikidoSeverity[] = [
  "critical",
  "high",
  "medium",
  "low",
]

const repoBaseUrl = (repo: Repo) =>
  `https://github.com/${repo.org}/${repo.name}`

function aikidoIssueUrl(repoId: number | null, groupId: number): string {
  return repoId != null
    ? `https://app.aikido.dev/repositories/${repoId}?sidebarIssue=${groupId}`
    : `https://app.aikido.dev/queue?sidebarIssue=${groupId}`
}

// Human-readable labels for Aikido issue types. Unknown types fall back to a
// title-cased version of the raw value (e.g. "some_new_type" -> "Some New Type").
const ISSUE_TYPE_LABELS: Record<string, string> = {
  open_source: "Open Source",
  sast: "SAST",
  leaked_secret: "Leaked Secret",
  iac: "IaC",
  cloud: "Cloud",
  malware: "Malware",
  eol: "End of Life",
}

function formatIssueType(type: string): string {
  return (
    ISSUE_TYPE_LABELS[type] ??
    type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  )
}

interface Props {
  repo: Repo | null
  onClose: () => void
}

export const RepoSidebar: React.FC<Props> = ({ repo, onClose }) => {
  const target = React.useMemo(
    () => document.getElementById("detail-panel"),
    [],
  )

  React.useEffect(() => {
    if (repo == null) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [repo, onClose])

  if (target == null) return null

  // The panel stays open; when nothing is selected, prompt the user.
  if (repo == null) {
    return createPortal(
      <aside
        className="repo-sidebar repo-sidebar--placeholder"
        aria-label="Repo details"
      >
        <div className="repo-sidebar-placeholder">
          <GitHubIcon />
          <p>Select a repository to see details.</p>
        </div>
      </aside>,
      target,
    )
  }

  const base = repoBaseUrl(repo)
  const github = repo.metrics.github
  // Human PRs first, then bots; newest first within each group.
  const allPrs = github.prs
    .map((pr) => ({ ...pr, bot: isBotPr(pr) }))
    .sort((a, b) =>
      a.bot !== b.bot
        ? a.bot
          ? 1
          : -1
        : b.createdAt.localeCompare(a.createdAt),
    )
  const updates = (github.availableUpdates ?? []).flatMap((category) =>
    category.updates.map((it) => ({
      name: it.name,
      toVersion: it.toVersion,
      categoryName: category.categoryName,
      isActionable: category.isActionable,
    })),
  )
  const actionableUpdates = updates.filter((it) => it.isActionable)

  const aikido = repo.metrics.aikido
  const aikidoIssues = [...aikido.issues].sort(
    (a, b) =>
      AIKIDO_SEVERITY_ORDER.indexOf(a.severity) -
        AIKIDO_SEVERITY_ORDER.indexOf(b.severity) ||
      a.title.localeCompare(b.title),
  )

  const coverage = repo.metrics.sonarCloud.testCoverage
  // Renovate's own dashboard links here for the repo's run logs (Mend portal).
  const mendUrl = `https://app.renovatebot.com/dashboard#github/${encodeURI(repo.id)}`

  return createPortal(
    <aside className="repo-sidebar" aria-label="Repo details">
      <header className="repo-sidebar-header">
        <div className="repo-sidebar-title">
          <GitHubIcon />
          <a href={base} target="_blank" rel="noreferrer">
            {repo.org !== "capralifecycle" && (
              <span className="repo-org">{repo.org}/</span>
            )}
            <span className="repo-name">{repo.name}</span>
          </a>
        </div>
        <button
          type="button"
          className="repo-sidebar-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </header>

      <div className="repo-sidebar-meta">
        <MetaItem label="Responsible" value={repo.responsible} />
        <MetaItem label="System" value={repo.system} />
        <MetaItem label="Customer" value={repo.customer} />
      </div>

      <Section icon={<PrIcon />} title="PRs" count={allPrs.length}>
        {allPrs.length === 0 ? (
          <p className="repo-sidebar-empty">No open PRs.</p>
        ) : (
          <table className="repo-sidebar-table repo-sidebar-table--pr">
            <thead>
              <tr>
                <th>PR</th>
                <th>Author</th>
              </tr>
            </thead>
            <tbody>
              {allPrs.map((pr) => (
                <tr
                  key={pr.number}
                  className={pr.bot ? "repo-sidebar-row-bot" : ""}
                >
                  <td>
                    <a
                      href={`${base}/pull/${pr.number}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {pr.title}
                    </a>
                    <span className="repo-sidebar-cell-meta">
                      #{pr.number} · {pr.createdAt.slice(0, 10)}
                    </span>
                  </td>
                  <td className="repo-sidebar-author">
                    {pr.bot && <span className="repo-sidebar-bot-tag">bot</span>}
                    <a
                      href={`https://github.com/${pr.author}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {pr.author}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section
        icon={<AikidoIcon />}
        title="Vulnerabilities (Aikido)"
        count={aikido.enabled ? aikidoIssues.length : undefined}
      >
        {!aikido.enabled ? (
          <p className="repo-sidebar-empty">Not onboarded in Aikido.</p>
        ) : aikidoIssues.length === 0 ? (
          <p className="repo-sidebar-empty">
            No open vulnerabilities.
            {aikido.ignoredCount > 0 && ` (${aikido.ignoredCount} ignored)`}
          </p>
        ) : (
          <>
            <table className="repo-sidebar-table repo-sidebar-table--vuln">
              <thead>
                <tr>
                  <th>Vulnerability</th>
                  <th>Type</th>
                  <th>Severity</th>
                </tr>
              </thead>
              <tbody>
                {aikidoIssues.map((issue, i) => (
                  <tr key={i} className={`sev-row-${issue.severity}`}>
                    <td>
                      <a
                        href={aikidoIssueUrl(aikido.repoId, issue.groupId)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {issue.title}
                      </a>
                    </td>
                    <td className="repo-sidebar-cell-meta">
                      {formatIssueType(issue.type)}
                    </td>
                    <td>
                      <span
                        className={`detail-severity severity-${issue.severity}`}
                      >
                        {issue.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {aikido.ignoredCount > 0 && (
              <p className="repo-sidebar-note">
                {aikido.ignoredCount} ignored
              </p>
            )}
          </>
        )}
      </Section>

      <Section icon={<SonarCloudIcon />} title="Coverage (SonarCloud)">
        {coverage ? (
          <p className="repo-sidebar-note">
            Test coverage: <strong>{coverage}%</strong>
          </p>
        ) : (
          <p className="repo-sidebar-empty">No coverage reported.</p>
        )}
      </Section>

      <Section
        icon={<RenovateIcon />}
        title="Dependencies"
        count={actionableUpdates.length}
      >
        {github.renovateDependencyDashboard == null ? (
          <p className="repo-sidebar-empty">
            Renovate is not set up.{" "}
            <a href={mendUrl} target="_blank" rel="noreferrer">
              Mend logs
            </a>
          </p>
        ) : (
          <>
            <p className="repo-sidebar-note">
              {github.renovateDependencyDashboard.daysSinceLastUpdate != null ? (
                <span
                  className={
                    github.renovateDependencyDashboard.daysSinceLastUpdate >= 20
                      ? "renovate-old"
                      : undefined
                  }
                >
                  Last updated{" "}
                  {github.renovateDependencyDashboard.daysSinceLastUpdate} days
                  ago
                </span>
              ) : (
                "No update date"
              )}
              {" · "}
              <a
                href={`${base}/issues/${github.renovateDependencyDashboard.issueNumber}`}
                target="_blank"
                rel="noreferrer"
              >
                Dependency Dashboard
              </a>
              {" · "}
              <a href={mendUrl} target="_blank" rel="noreferrer">
                Mend logs
              </a>
            </p>
            {updates.length === 0 ? (
              <p className="repo-sidebar-empty">No available updates.</p>
            ) : (
              <ul className="repo-sidebar-list">
                {updates.map((u, i) => (
                  <li
                    key={i}
                    className={`repo-sidebar-list-item${!u.isActionable ? " repo-sidebar-list-item-muted" : ""}`}
                  >
                    <span className="repo-sidebar-list-main">{u.name}</span>
                    <span className="detail-meta">
                      {u.toVersion} · {u.categoryName}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Section>
    </aside>,
    target,
  )
}

const MetaItem: React.FC<{ label: string; value?: string }> = ({
  label,
  value,
}) =>
  value ? (
    <div className="repo-sidebar-meta-item">
      <span className="repo-sidebar-meta-label">{label}</span>
      <span className="repo-sidebar-meta-value">{value}</span>
    </div>
  ) : null

const Section: React.FC<
  React.PropsWithChildren<{
    icon: React.ReactNode
    title: string
    count?: number
  }>
> = ({ icon, title, count, children }) => (
  <section className="repo-sidebar-section">
    <h3 className="repo-sidebar-section-title">
      {icon}
      {title}
      {count != null && count > 0 && (
        <span className="repo-sidebar-section-count">{count}</span>
      )}
    </h3>
    {children}
  </section>
)


import type {
  Repo,
  WebappData,
} from "@liflig/repo-metrics-repo-collector-types"
import { groupBy, sumBy } from "lodash-es"
import * as React from "react"
import { createPortal } from "react-dom"
import { Checkbox } from "./Checkbox"
import { DataGroup } from "./DataGroup"
import { ENABLE_GLOBAL_STATS, ENABLE_SORT_BY_RENOVATE_DAYS, type Filter } from "./filter"
import { toQueryString } from "./filter"
import { FilterActionType, filterReducer } from "./filterReducer"
import { isActionableRepo } from "./Repo"
import { RepoSidebar } from "./RepoSidebar"
import { isBotPr } from "./prUtils"
import { buildMarkdownSummary } from "./copyUtils"

const NONE_SENTINEL = "__none__"

interface Props {
  data: WebappData
  filter: Filter
}

export const DataList: React.FC<Props> = ({ data, filter }) => {
  const [state, dispatch] = React.useReducer(filterReducer, filter)
  const [selectedRepoId, setSelectedRepoId] = React.useState<string | null>(
    null,
  )

  const selectedRepo = React.useMemo(
    () => data.repos.find((r) => r.id === selectedRepoId) ?? null,
    [data.repos, selectedRepoId],
  )

  const handleSelectRepo = React.useCallback(
    (repo: Repo) =>
      setSelectedRepoId((prev) => (prev === repo.id ? null : repo.id)),
    [],
  )

  React.useEffect(() => {
    const queryString = toQueryString(state)
    history.replaceState(state, "", queryString ? `?${queryString}` : "/")
  }, [state])

  function filterRepo(repo: Repo): boolean {
    if (
      state.filterRepoName !== "" &&
      !repo.id.toUpperCase().includes(state.filterRepoName.toUpperCase())
    )
      return false
    const anyFilterActive =
      state.showOnlyWithPrs ||
      state.showOnlyWithBotPrs ||
      state.showOnlyWithVulns ||
      state.showOnlyMissingCoverage
    if (anyFilterActive) {
      const matchesPrs = state.showOnlyWithPrs && repo.metrics.github.prs.some((p) => !isBotPr(p))
      const matchesBotPrs = state.showOnlyWithBotPrs && repo.metrics.github.prs.some((p) => isBotPr(p))
      const matchesVulns = state.showOnlyWithVulns && repo.metrics.aikido.issues.length > 0
      const matchesMissingCoverage = state.showOnlyMissingCoverage && !repo.metrics.sonarCloud.testCoverage
      if (!matchesPrs && !matchesBotPrs && !matchesVulns && !matchesMissingCoverage) return false
    }
    return true
  }

  const prSearch = state.filterUpdateName.toLowerCase()
  const vulSearch = state.filterVulName.toLowerCase()

  function filterByPrTitle(repo: Repo): boolean {
    return repo.metrics.github.prs.some((pr) =>
      pr.title.toLowerCase().includes(prSearch),
    )
  }

  function filterByVulnerability(repo: Repo): boolean {
    return repo.metrics.aikido.issues.some((i) =>
      i.title.toLowerCase().includes(vulSearch),
    )
  }

  const filteredRepos = data.repos
    .filter(filterRepo)
    .filter((it) => prSearch === "" || filterByPrTitle(it))
    .filter((it) => vulSearch === "" || filterByVulnerability(it))

  const byResponsible = groupBy(
    filteredRepos,
    (it) => it.responsible ?? "Unknown",
  )

  const bySystem = groupBy(filteredRepos, (it) => it.system ?? "Unknown")

  const allByResponsible = React.useMemo(
    () => groupBy(data.repos, (it) => it.responsible ?? "Unknown"),
    [data.repos],
  )

  const allBySystem = React.useMemo(
    () => groupBy(data.repos, (it) => it.system ?? "Unknown"),
    [data.repos],
  )

  const createOnCheckHandler = (prop: keyof Filter) => () =>
    dispatch({
      type: FilterActionType.TOGGLE_BOOLEAN,
      prop,
    })

  const formatLocalTimestamp = (timestamp: string) => {
    const d = new Date(timestamp)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  const statsByResponsible = React.useMemo(() => {
    const grouped = groupBy(data.repos, (it) => it.responsible ?? "Unknown")
    return Object.entries(grouped)
      .map(([responsible, repos]) => ({
        groupKey: responsible,
        repos: repos.length,
        prs: sumBy(repos, (it) => it.metrics.github.prs.length),
        vulnerabilities: sumBy(
          repos,
          (it) => it.metrics.aikido.issues.length,
        ),
      }))
      .sort((a, b) => a.groupKey.localeCompare(b.groupKey))
  }, [data.repos])

  const statsBySystem = React.useMemo(() => {
    const grouped = groupBy(data.repos, (it) => it.system ?? "Unknown")
    return Object.entries(grouped)
      .map(([system, repos]) => ({
        groupKey: system,
        repos: repos.length,
        prs: sumBy(repos, (it) => it.metrics.github.prs.length),
        vulnerabilities: sumBy(
          repos,
          (it) => it.metrics.aikido.issues.length,
        ),
      }))
      .sort((a, b) => a.groupKey.localeCompare(b.groupKey))
  }, [data.repos])

  const activeStats =
    state.groupBy === "system" ? statsBySystem : statsByResponsible
  const activeGrouped =
    state.groupBy === "system" ? bySystem : byResponsible
  const activeAllGrouped =
    state.groupBy === "system" ? allBySystem : allByResponsible

  const allTeamsSelected =
    state.selectedTeams.length === 0 ||
    state.selectedTeams.length === activeStats.length

  const visibleTeams = allTeamsSelected
    ? Object.keys(activeGrouped).sort()
    : state.selectedTeams
        .filter((t) => t in activeGrouped)
        .sort()

  const toggleTeam = (team: string) =>
    dispatch({
      type: FilterActionType.TOGGLE_TEAM,
      prop: "selectedTeams",
      payload: team,
    })

  type SummarySort = "groupKey" | "repos" | "prs" | "vulnerabilities"
  const [summarySort, setSummarySort] = React.useState<{
    key: SummarySort
    asc: boolean
  }>({ key: "groupKey", asc: true })

  const toggleSummarySort = (key: SummarySort) =>
    setSummarySort((prev) =>
      prev.key === key ? { key, asc: !prev.asc } : { key, asc: true },
    )

  const sortedStats = [...activeStats].sort((a, b) => {
    const va = a[summarySort.key]
    const vb = b[summarySort.key]
    const cmp =
      typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number)
    return summarySort.asc ? cmp : -cmp
  })

  const sortIndicator = (key: SummarySort) =>
    summarySort.key === key ? (summarySort.asc ? " ▲" : " ▼") : ""

  const sidebarEl = React.useMemo(() => document.getElementById("sidebar-filters"), [])
  const footerEl = React.useMemo(() => document.getElementById("sidebar-footer"), [])

  return (
    <>
      {sidebarEl && createPortal(
        <>
          <div className="filter-group">
            <span className="filter-group-label">Grouping</span>
            <div className="team-grid">
              <button
                type="button"
                className={`team-btn${state.groupBy === "responsible" ? " team-btn-active" : ""}`}
                onClick={() =>
                  dispatch({
                    type: FilterActionType.SET_GROUP_BY,
                    prop: "groupBy",
                    payload: "responsible",
                  })
                }
              >
                Responsible
              </button>
              <button
                type="button"
                className={`team-btn${state.groupBy === "system" ? " team-btn-active" : ""}`}
                onClick={() =>
                  dispatch({
                    type: FilterActionType.SET_GROUP_BY,
                    prop: "groupBy",
                    payload: "system",
                  })
                }
              >
                System
              </button>
            </div>
          </div>
          <div className="filter-group">
            <span className="filter-group-label">
              {state.groupBy === "system" ? "System" : "Team"}
            </span>
            {state.groupBy === "system" ? (
              <SystemToggleGrid
                stats={activeStats}
                allTeamsSelected={allTeamsSelected}
                selectedTeams={state.selectedTeams}
                onToggle={(key) => {
                  const isNone = state.selectedTeams.includes(NONE_SENTINEL)
                  if (allTeamsSelected || isNone) {
                    dispatch({
                      type: FilterActionType.SET_TEAMS,
                      prop: "selectedTeams",
                      payload: key,
                    })
                  } else {
                    toggleTeam(key)
                  }
                }}
                onSetTeams={(keys) =>
                  dispatch({
                    type: FilterActionType.SET_TEAMS,
                    prop: "selectedTeams",
                    payload: keys.length > 0 ? keys.join(",") : "",
                  })
                }
              />
            ) : (
              <div className="team-grid">
                <button
                  type="button"
                  className={`team-btn${allTeamsSelected ? " team-btn-active" : ""}`}
                  onClick={() =>
                    dispatch({
                      type: FilterActionType.SET_TEAMS,
                      prop: "selectedTeams",
                      payload: allTeamsSelected ? NONE_SENTINEL : "",
                    })
                  }
                >
                  All
                </button>
                {activeStats.map((s) => {
                  const isSelected = state.selectedTeams.includes(s.groupKey)
                  const showAll = allTeamsSelected
                  const isNone = state.selectedTeams.includes(NONE_SENTINEL)
                  return (
                    <button
                      type="button"
                      key={s.groupKey}
                      className={`team-btn${showAll || isSelected ? " team-btn-active" : ""}`}
                      onClick={() => {
                        if (showAll || isNone) {
                          dispatch({
                            type: FilterActionType.SET_TEAMS,
                            prop: "selectedTeams",
                            payload: s.groupKey,
                          })
                        } else {
                          toggleTeam(s.groupKey)
                        }
                      }}
                    >
                      {s.groupKey}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <div className="filter-group">
            <span className="filter-group-label">Search</span>
            <input
              type="text"
              className="sidebar-search"
              value={state.filterRepoName}
              onChange={(e) => {
                dispatch({
                  type: FilterActionType.CHANGE_SEARCH_FILTER,
                  prop: "filterRepoName",
                  payload: e.target.value,
                })
              }}
              placeholder="Repo..."
            />
            <input
              type="text"
              className="sidebar-search"
              value={state.filterUpdateName}
              onChange={(e) => {
                dispatch({
                  type: FilterActionType.CHANGE_SEARCH_FILTER,
                  prop: "filterUpdateName",
                  payload: e.target.value,
                })
              }}
              placeholder="PR..."
            />
            <input
              type="text"
              className="sidebar-search"
              value={state.filterVulName}
              onChange={(e) => {
                dispatch({
                  type: FilterActionType.CHANGE_SEARCH_FILTER,
                  prop: "filterVulName",
                  payload: e.target.value,
                })
              }}
              placeholder="Vulnerability..."
            />
          </div>
          <button
            type="button"
            className={`todo-btn${state.showOnlyWithPrs && state.showOnlyWithBotPrs ? " todo-btn-active" : ""}`}
            onClick={() => {
              const allOn = state.showOnlyWithPrs && state.showOnlyWithBotPrs
              dispatch({
                type: FilterActionType.SET_BOOLEANS,
                prop: String(!allOn),
                payload: "showOnlyWithPrs,showOnlyWithBotPrs",
              })
            }}
          >
            TODO
          </button>
          <div className="filter-group">
            <span className="filter-group-label">Filter</span>
            <Checkbox
              checked={state.showOnlyWithPrs}
              onCheck={createOnCheckHandler("showOnlyWithPrs")}
            >
              Has PRs
            </Checkbox>
            <Checkbox
              checked={state.showOnlyWithBotPrs}
              onCheck={createOnCheckHandler("showOnlyWithBotPrs")}
            >
              Has bot PRs
            </Checkbox>
            <Checkbox
              checked={state.showOnlyWithVulns}
              onCheck={createOnCheckHandler("showOnlyWithVulns")}
            >
              Has vulns
            </Checkbox>
            <Checkbox
              checked={state.showOnlyMissingCoverage}
              onCheck={createOnCheckHandler("showOnlyMissingCoverage")}
            >
              Missing coverage
            </Checkbox>
          </div>
          <div className="filter-group">
            <span className="filter-group-label">Show details</span>
            <Checkbox
              checked={state.showPrList}
              onCheck={createOnCheckHandler("showPrList")}
            >
              PRs
            </Checkbox>
            <Checkbox
              checked={state.showBotPrList}
              onCheck={createOnCheckHandler("showBotPrList")}
            >
              Bot PR
            </Checkbox>
            <Checkbox
              checked={state.showVulAikidoList}
              onCheck={createOnCheckHandler("showVulAikidoList")}
            >
              Vulnerabilities (Aikido)
            </Checkbox>
            <Checkbox
              checked={state.showOrgName}
              onCheck={createOnCheckHandler("showOrgName")}
            >
              GitHub organization
            </Checkbox>
            {ENABLE_SORT_BY_RENOVATE_DAYS && (
              <Checkbox
                checked={state.sortByRenovateDays}
                onCheck={createOnCheckHandler("sortByRenovateDays")}
              >
                Sort by Renovate days
              </Checkbox>
            )}
          </div>
          <div className="filter-group">
            <span className="filter-group-label">
              {state.groupBy === "system" ? "System Stats" : "Team Stats"}
            </span>
            <table className="summary-table">
              <thead>
                <tr>
                  <th className="clickeableHeader" onClick={() => toggleSummarySort("groupKey")}>
                    {state.groupBy === "system" ? "System" : "Team"}{sortIndicator("groupKey")}
                  </th>
                  <th className="clickeableHeader" onClick={() => toggleSummarySort("repos")}>
                    Repo{sortIndicator("repos")}
                  </th>
                  <th className="clickeableHeader" onClick={() => toggleSummarySort("prs")}>
                    PRs{sortIndicator("prs")}
                  </th>
                  <th className="clickeableHeader" onClick={() => toggleSummarySort("vulnerabilities")}>
                    Vuln.{sortIndicator("vulnerabilities")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedStats.map((s) => (
                  <tr key={s.groupKey}>
                    <td>{s.groupKey}</td>
                    <td>{s.repos}</td>
                    <td>{s.prs > 0 ? s.prs : "–"}</td>
                    <td>{s.vulnerabilities > 0 ? s.vulnerabilities : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ENABLE_GLOBAL_STATS && <GlobalStats repos={data.repos} />}
        </>,
        sidebarEl,
      )}
      {footerEl && createPortal(
        <>
          <p className="timestamps">
            Last updated: {formatLocalTimestamp(data.aggregatedAt)}
          </p>
          <p className="timestamps">
            Build: <a href={`https://github.com/capralifecycle/liflig-repo-metrics/commit/${__BUILD_INFO__.commitHash}`}>{__BUILD_INFO__.commitHash}</a>
          </p>
        </>,
        footerEl,
      )}
      {visibleTeams.map((groupKey) => {
        const repos = activeGrouped[groupKey]
        if (!repos) return null
        return (
          <React.Fragment key={groupKey}>
            <SectionHeader
              responsible={groupKey}
              repos={repos}
              allRepos={activeAllGrouped[groupKey] ?? repos}
              aggregatedAt={data.aggregatedAt}
            />
            <DataGroup
              repos={repos}
              showPrList={state.showPrList}
              showBotPrList={state.showBotPrList}
              showVulAikidoList={state.showVulAikidoList}
              showOrgName={state.showOrgName}
              sortByRenovateDays={state.sortByRenovateDays}
              filterRepoName={state.filterRepoName}
              filterUpdateName={state.filterUpdateName}
              filterVulName={state.filterVulName}
              selectedRepoId={selectedRepoId ?? undefined}
              onSelectRepo={handleSelectRepo}
              compact
            />
          </React.Fragment>
        )
      })}
      <RepoSidebar repo={selectedRepo} onClose={() => setSelectedRepoId(null)} />
    </>
  )
}

const LIFLIG_PREFIX = "liflig-"

const SystemToggleGrid: React.FC<{
  stats: { groupKey: string }[]
  allTeamsSelected: boolean
  selectedTeams: string[]
  onToggle: (key: string) => void
  onSetTeams: (keys: string[]) => void
}> = ({ stats, allTeamsSelected, selectedTeams, onToggle, onSetTeams }) => {
  const lifligSystems = stats
    .filter((s) => s.groupKey.startsWith(LIFLIG_PREFIX))
    .sort((a, b) => a.groupKey.localeCompare(b.groupKey))
  const customerSystems = stats
    .filter((s) => !s.groupKey.startsWith(LIFLIG_PREFIX))
    .sort((a, b) => a.groupKey.localeCompare(b.groupKey))

  const lifligKeys = lifligSystems.map((s) => s.groupKey)
  const customerKeys = customerSystems.map((s) => s.groupKey)

  const allLifligSelected =
    allTeamsSelected || lifligKeys.every((k) => selectedTeams.includes(k))
  const allCustomerSelected =
    allTeamsSelected || customerKeys.every((k) => selectedTeams.includes(k))

  const toggleGroup = (groupKeys: string[], allSelected: boolean) => {
    if (allTeamsSelected) {
      // From "all", narrow down to just this group
      onSetTeams(groupKeys)
    } else if (allSelected) {
      // Deselect this group
      onSetTeams(selectedTeams.filter((k) => !groupKeys.includes(k)))
    } else {
      // Add this group
      onSetTeams([...new Set([...selectedTeams, ...groupKeys])])
    }
  }

  const renderBtn = (s: { groupKey: string }) => {
    const isSelected = selectedTeams.includes(s.groupKey)
    const showAll = allTeamsSelected
    return (
      <button
        type="button"
        key={s.groupKey}
        className={`team-btn${showAll || isSelected ? " team-btn-active" : ""}`}
        onClick={() => onToggle(s.groupKey)}
      >
        {s.groupKey}
      </button>
    )
  }

  return (
    <div className="system-toggle-columns">
      <div className="system-toggle-column">
        <button
          type="button"
          className={`team-btn system-toggle-group-btn${allLifligSelected ? " team-btn-active" : ""}`}
          onClick={() => toggleGroup(lifligKeys, allLifligSelected)}
        >
          Liflig
        </button>
        {lifligSystems.map(renderBtn)}
      </div>
      <div className="system-toggle-column">
        <button
          type="button"
          className={`team-btn system-toggle-group-btn${allCustomerSelected ? " team-btn-active" : ""}`}
          onClick={() => toggleGroup(customerKeys, allCustomerSelected)}
        >
          Customer
        </button>
        {customerSystems.map(renderBtn)}
      </div>
    </div>
  )
}

const SectionHeader: React.FC<{
  responsible: string
  repos: Repo[]
  allRepos: Repo[]
  aggregatedAt: string
}> = ({ responsible, repos, allRepos, aggregatedAt }) => {
  const updates = sumBy(
    repos,
    (it) =>
      (it.metrics.github.availableUpdates ?? []).flatMap((c) =>
        c.isActionable ? c.updates : [],
      ).length,
  )
  const prs = sumBy(repos, (it) => it.metrics.github.prs.filter((p) => !isBotPr(p)).length)
  const botPrs = sumBy(repos, (it) => it.metrics.github.prs.filter((p) => isBotPr(p)).length)

  return (
    <div className="section-header">
      <div className="section-title-row">
        <h2>{responsible}</h2>
        <CopySummaryButton repos={allRepos} team={responsible} aggregatedAt={aggregatedAt} />
      </div>
      <div className="section-stats">
        <span className="section-badge">{repos.length} repos</span>
        <span className={`section-badge ${updates > 0 ? "badge-renovate" : "badge-ok"}`}>
          {updates} updates
        </span>
        <span className={`section-badge ${prs > 0 ? "badge-pr" : "badge-ok"}`}>
          {prs} PRs
        </span>
        <span className={`section-badge ${botPrs > 0 ? "badge-pr" : "badge-ok"}`}>
          {botPrs} bot PR
        </span>
      </div>
    </div>
  )
}

const GlobalStats: React.FC<{ repos: Repo[] }> = ({ repos }) => {
  const totalRepos = repos.length
  const totalPrs = sumBy(repos, (r) => r.metrics.github.prs.length)
  const totalUpdates = sumBy(
    repos,
    (r) =>
      (r.metrics.github.availableUpdates ?? []).flatMap((c) =>
        c.isActionable ? c.updates : [],
      ).length,
  )
  const aikidoVul = sumBy(repos, (r) => r.metrics.aikido.issues.length)
  const actionable = repos.filter((r) => isActionableRepo(r.metrics)).length
  const vulnerable = repos.filter(
    (r) => r.metrics.aikido.issues.length > 0,
  ).length

  return (
    <div className="filter-group">
      <span className="filter-group-label">Global Stats</span>
      <div className="global-stats">
        <div className="global-stat">
          <span className="global-stat-value">{totalRepos}</span>
          <span className="global-stat-label">repos</span>
        </div>
        <div className="global-stat">
          <span className="global-stat-value">{actionable}</span>
          <span className="global-stat-label">with updates/bot PRs</span>
        </div>
        <div className="global-stat">
          <span className="global-stat-value">{totalPrs}</span>
          <span className="global-stat-label">PRs</span>
        </div>
        <div className="global-stat">
          <span className="global-stat-value">{totalUpdates}</span>
          <span className="global-stat-label">updates</span>
        </div>
        <div className="global-stat stat-danger">
          <span className="global-stat-value">{vulnerable}</span>
          <span className="global-stat-label">vulnerable repos</span>
        </div>
        <div className="global-stat stat-danger">
          <span className="global-stat-value">{aikidoVul}</span>
          <span className="global-stat-label">vulnerabilities</span>
        </div>
      </div>
    </div>
  )
}

const CopySummaryButton: React.FC<{
  repos: Repo[]
  team: string
  aggregatedAt: string
}> = ({ repos, team, aggregatedAt }) => {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = () => {
    const md = buildMarkdownSummary({ repos, team, aggregatedAt })
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button type="button" className="copy-summary-btn" onClick={handleCopy}>
      {copied ? "Copied!" : "Copy summary"}
    </button>
  )
}

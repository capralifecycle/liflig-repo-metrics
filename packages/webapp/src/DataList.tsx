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
import { isActionableRepo, isVulnerableRepo } from "./Repo"
import { isBotPr } from "./prUtils"
import { buildMarkdownSummary } from "./copyUtils"

const NONE_SENTINEL = "__none__"

interface Props {
  data: WebappData
  filter: Filter
}

export const DataList: React.FC<Props> = ({ data, filter }) => {
  const [state, dispatch] = React.useReducer(filterReducer, filter)

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
      state.showOnlyWithPrs || state.showOnlyWithBotPrs ||
      state.showOnlyWithGithubVul || state.showOnlyWithSnykVul
    if (anyFilterActive) {
      const matchesPrs = state.showOnlyWithPrs && repo.metrics.github.prs.some((p) => !isBotPr(p))
      const matchesBotPrs = state.showOnlyWithBotPrs && repo.metrics.github.prs.some((p) => isBotPr(p))
      const matchesGithubVul = state.showOnlyWithGithubVul && repo.metrics.github.vulnerabilityAlerts.length > 0
      const matchesSnykVul = state.showOnlyWithSnykVul && (repo.metrics.snyk?.totalIssues ?? 0) > 0
      if (!matchesPrs && !matchesBotPrs && !matchesGithubVul && !matchesSnykVul) return false
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
    const ghMatch = repo.metrics.github.vulnerabilityAlerts.some((a) =>
      a.packageName.toLowerCase().includes(vulSearch),
    )
    const snykMatch =
      repo.metrics.snyk?.vulnerableProjects.some((p) =>
        p.path.toLowerCase().includes(vulSearch),
      ) ?? false
    return ghMatch || snykMatch
  }

  const filteredRepos = data.repos
    .filter(filterRepo)
    .filter((it) => prSearch === "" || filterByPrTitle(it))
    .filter((it) => vulSearch === "" || filterByVulnerability(it))

  const byResponsible = groupBy(
    filteredRepos,
    (it) => it.responsible ?? "Ukjent",
  )

  const bySystem = groupBy(filteredRepos, (it) => it.system ?? "Ukjent")

  const allByResponsible = React.useMemo(
    () => groupBy(data.repos, (it) => it.responsible ?? "Ukjent"),
    [data.repos],
  )

  const allBySystem = React.useMemo(
    () => groupBy(data.repos, (it) => it.system ?? "Ukjent"),
    [data.repos],
  )

  const createOnCheckHandler = (prop: keyof Filter) => () =>
    dispatch({
      type: FilterActionType.TOGGLE_BOOLEAN,
      prop,
    })

  const removeMillisecondsFromTimestamp = (timestamp: string) => {
    const [yearMonthDay, restOfTimestamp] = timestamp.split("T")
    const hourMinuteSecond = restOfTimestamp.split(".")[0]
    return `${yearMonthDay} ${hourMinuteSecond}`
  }

  const statsByResponsible = React.useMemo(() => {
    const grouped = groupBy(data.repos, (it) => it.responsible ?? "Ukjent")
    return Object.entries(grouped)
      .map(([responsible, repos]) => ({
        groupKey: responsible,
        repos: repos.length,
        prs: sumBy(repos, (it) => it.metrics.github.prs.length),
        vulnerabilities:
          sumBy(
            repos,
            (it) => it.metrics.github.vulnerabilityAlerts.length,
          ) + sumBy(repos, (it) => it.metrics.snyk?.totalIssues ?? 0),
      }))
      .sort((a, b) => a.groupKey.localeCompare(b.groupKey))
  }, [data.repos])

  const statsBySystem = React.useMemo(() => {
    const grouped = groupBy(data.repos, (it) => it.system ?? "Ukjent")
    return Object.entries(grouped)
      .map(([system, repos]) => ({
        groupKey: system,
        repos: repos.length,
        prs: sumBy(repos, (it) => it.metrics.github.prs.length),
        vulnerabilities:
          sumBy(
            repos,
            (it) => it.metrics.github.vulnerabilityAlerts.length,
          ) + sumBy(repos, (it) => it.metrics.snyk?.totalIssues ?? 0),
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
            <span className="filter-group-label">Gruppering</span>
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
                Ansvarlig
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
                Alle
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
          </div>
          <div className="filter-group">
            <span className="filter-group-label">Søk</span>
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
              placeholder="Sårbarhet..."
            />
          </div>
          <button
            type="button"
            className={`todo-btn${state.showOnlyWithPrs && state.showOnlyWithBotPrs && state.showOnlyWithGithubVul && state.showOnlyWithSnykVul ? " todo-btn-active" : ""}`}
            onClick={() => {
              const allOn = state.showOnlyWithPrs && state.showOnlyWithBotPrs && state.showOnlyWithGithubVul && state.showOnlyWithSnykVul
              dispatch({
                type: FilterActionType.SET_BOOLEANS,
                prop: String(!allOn),
                payload: "showOnlyWithPrs,showOnlyWithBotPrs,showOnlyWithGithubVul,showOnlyWithSnykVul",
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
              Har PRs
            </Checkbox>
            <Checkbox
              checked={state.showOnlyWithBotPrs}
              onCheck={createOnCheckHandler("showOnlyWithBotPrs")}
            >
              Har bot-PRs
            </Checkbox>
            <Checkbox
              checked={state.showOnlyWithGithubVul}
              onCheck={createOnCheckHandler("showOnlyWithGithubVul")}
            >
              Har GitHub-sårbarheter
            </Checkbox>
            <Checkbox
              checked={state.showOnlyWithSnykVul}
              onCheck={createOnCheckHandler("showOnlyWithSnykVul")}
            >
              Har Snyk-sårbarheter
            </Checkbox>
          </div>
          <div className="filter-group">
            <span className="filter-group-label">Vis detaljer</span>
            <Checkbox
              checked={state.showDepList}
              onCheck={createOnCheckHandler("showDepList")}
            >
              Avhengigheter
            </Checkbox>
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
              checked={state.showVulGithubList}
              onCheck={createOnCheckHandler("showVulGithubList")}
            >
              Sårbarheter (GitHub)
            </Checkbox>
            <Checkbox
              checked={state.showVulSnykList}
              onCheck={createOnCheckHandler("showVulSnykList")}
            >
              Sårbarheter (Snyk)
            </Checkbox>
            <Checkbox
              checked={state.showOrgName}
              onCheck={createOnCheckHandler("showOrgName")}
            >
              GitHub-organisasjon
            </Checkbox>
            {ENABLE_SORT_BY_RENOVATE_DAYS && (
              <Checkbox
                checked={state.sortByRenovateDays}
                onCheck={createOnCheckHandler("sortByRenovateDays")}
              >
                Sorter etter Renovate-dager
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
                    Sårb.{sortIndicator("vulnerabilities")}
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
            Sist oppdatert: {removeMillisecondsFromTimestamp(data.aggregatedAt)}
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
              showDepList={state.showDepList}
              showVulGithubList={state.showVulGithubList}
              showVulSnykList={state.showVulSnykList}
              showOrgName={state.showOrgName}
              sortByRenovateDays={state.sortByRenovateDays}
              filterRepoName={state.filterRepoName}
              filterUpdateName={state.filterUpdateName}
              filterVulName={state.filterVulName}
            />
          </React.Fragment>
        )
      })}
    </>
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
  const githubVul = sumBy(
    repos,
    (it) => it.metrics.github.vulnerabilityAlerts.length,
  )
  const snykVul = sumBy(repos, (it) => it.metrics.snyk?.totalIssues ?? 0)

  const prs = sumBy(repos, (it) => it.metrics.github.prs.filter((p) => !isBotPr(p)).length)
  const botPrs = sumBy(repos, (it) => it.metrics.github.prs.filter((p) => isBotPr(p)).length)

  return (
    <div className="section-header">
      <div className="section-title-row">
        <h2>{responsible}</h2>
        <CopySummaryButton repos={allRepos} team={responsible} aggregatedAt={aggregatedAt} />
      </div>
      <div className="section-stats">
        <span className="section-badge">{repos.length} repoer</span>
        <span className={`section-badge ${updates > 0 ? "badge-renovate" : "badge-ok"}`}>
          {updates} avh.
        </span>
        <span className={`section-badge ${prs > 0 ? "badge-pr" : "badge-ok"}`}>
          {prs} PRs
        </span>
        <span className={`section-badge ${botPrs > 0 ? "badge-pr" : "badge-ok"}`}>
          {botPrs} bot PR
        </span>
        <span className={`section-badge ${snykVul > 0 ? "badge-vuln" : "badge-ok"}`}>
          {snykVul} snyk
        </span>
        <span className={`section-badge ${githubVul > 0 ? "badge-vuln" : "badge-ok"}`}>
          {githubVul} github
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
  const githubVul = sumBy(
    repos,
    (r) => r.metrics.github.vulnerabilityAlerts.length,
  )
  const snykVul = sumBy(repos, (r) => r.metrics.snyk?.totalIssues ?? 0)
  const actionable = repos.filter((r) => isActionableRepo(r.metrics)).length
  const vulnerable = repos.filter((r) => isVulnerableRepo(r.metrics)).length

  return (
    <div className="filter-group">
      <span className="filter-group-label">Global Stats</span>
      <div className="global-stats">
        <div className="global-stat">
          <span className="global-stat-value">{totalRepos}</span>
          <span className="global-stat-label">repoer</span>
        </div>
        <div className="global-stat">
          <span className="global-stat-value">{actionable}</span>
          <span className="global-stat-label">med oppdateringer/bot-PRs/sårbarheter</span>
        </div>
        <div className="global-stat">
          <span className="global-stat-value">{totalPrs}</span>
          <span className="global-stat-label">PRs</span>
        </div>
        <div className="global-stat">
          <span className="global-stat-value">{totalUpdates}</span>
          <span className="global-stat-label">oppdateringer</span>
        </div>
        <div className="global-stat stat-danger">
          <span className="global-stat-value">{vulnerable}</span>
          <span className="global-stat-label">sårbare repoer</span>
        </div>
        <div className="global-stat stat-danger">
          <span className="global-stat-value">{githubVul + snykVul}</span>
          <span className="global-stat-label">sårbarheter</span>
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
      {copied ? "Kopiert!" : "Kopier sammendrag"}
    </button>
  )
}

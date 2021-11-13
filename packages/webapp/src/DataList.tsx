import {
  WebappMetricData,
  WebappMetricDataRepo,
  WebappStatsByFetchGroup,
} from "@liflig/repo-metrics-repo-collector-types"
import { groupBy } from "lodash"
import * as React from "react"
import { Checkbox } from "./Checkbox"
import { DataGroup } from "./DataGroup"
import { isActionableRepo, isVulnerableRepo } from "./Repo"

interface Props {
  data: WebappMetricData
  filterState: FilterState
}

export interface FilterState extends Record<string, boolean> {
  showPrList: boolean
  showDepList: boolean
  showVulList: boolean
  groupByResponsible: boolean
  showOnlyActionable: boolean
  showOnlyVulnerable: boolean
  sortByRenovateDays: boolean
}

export const defaultValues: FilterState = {
  showPrList: false,
  showDepList: false,
  showVulList: false,
  groupByResponsible: true,
  showOnlyActionable: false,
  showOnlyVulnerable: false,
  sortByRenovateDays: false,
}

enum FilterActionType {
  TOGGLE_BOOLEAN = "toggle_boolean",
}

interface FilterAction<T = keyof FilterState> {
  type: FilterActionType
  prop: T
}

function filterReducer(state: FilterState, action: FilterAction) {
  switch (action.type) {
    case FilterActionType.TOGGLE_BOOLEAN:
      return { ...state, [action.prop]: !state[action.prop] }
    default:
      throw new Error()
  }
}

function ageInDays(timestamp: string) {
  // Approx to simplify.
  return Math.floor(
    (new Date().getTime() - new Date(timestamp).getTime()) / 86400000,
  )
}

function filterFetchGroupRepos(
  data: WebappStatsByFetchGroup[],
  repoPredicate: (item: WebappStatsByFetchGroup["repos"][0]) => boolean,
): WebappStatsByFetchGroup[] {
  return data.flatMap((it) => {
    const repos = it.repos.filter(repoPredicate)

    if (repos.length === 0) {
      return []
    } else {
      return [
        {
          ...it,
          repos,
        },
      ]
    }
  })
}

export const DataList: React.FC<Props> = ({ data, filterState }) => {
  const [state, dispatch] = React.useReducer(filterReducer, filterState)

  React.useEffect(() => {
    const params = Object.keys(defaultValues)
      .filter((k) => defaultValues[k] !== state[k])
      .map((k) => `${k}=${state[k].toString()}`)
      .join("&")

    history.replaceState(state, "", params ? `?${params}` : "/")
  }, [state])

  const limitDays = 30

  const [limitGraphDays, setLimitGraphDays] = React.useState<number | null>(
    limitDays,
  )

  const [filterDepName, setFilterDepName] = React.useState("")
  const [filterRepoName, setFilterRepoName] = React.useState("")

  const [collapseResponsible, setCollapseResponsible] = React.useState<
    string[]
  >([])

  const actionableRepos = state.showOnlyActionable
    ? data.repos
        .filter((it) => isActionableRepo(it.lastDatapoint))
        .map((it) => it.repoId)
    : []

  const vulnerableRepos = state.showOnlyVulnerable
    ? data.repos
        .filter((it) => isVulnerableRepo(it.lastDatapoint))
        .map((it) => it.repoId)
    : []

  function filterRepoId(repoId: string): boolean {
    return (
      (filterRepoName === "" || repoId.includes(filterRepoName)) &&
      (!state.showOnlyActionable || actionableRepos.includes(repoId)) &&
      (!state.showOnlyVulnerable || vulnerableRepos.includes(repoId))
    )
  }

  function filterByUpdates(repo: WebappMetricDataRepo): boolean {
    return (
      filterDepName === "" ||
      (repo.lastDatapoint.github.availableUpdates?.some((category) =>
        category.updates.some((update) => update.name.includes(filterDepName)),
      ) ??
        false)
    )
  }

  function filterByVulnerabilities(repo: WebappMetricDataRepo): boolean {
    return (
      filterDepName === "" ||
      repo.lastDatapoint.github.vulnerabilityAlerts.some((alert) =>
        alert.packageName.includes(filterDepName),
      )
    )
  }

  const filteredRepos = data.repos
    .filter((it) => filterRepoId(it.repoId))
    .filter((it) => filterByUpdates(it) || filterByVulnerabilities(it))

  const shownRepoIds = filteredRepos.map((it) => it.repoId)

  const filteredFetchGroups = filterFetchGroupRepos(
    data.byFetchGroup.filter(
      (it) =>
        limitGraphDays == null || ageInDays(it.timestamp) < limitGraphDays,
    ),
    (it) => shownRepoIds.includes(it.repoId),
  )

  const byResponsible = state.groupByResponsible
    ? groupBy(filteredRepos, (it) => it.responsible ?? "Ukjent")
    : undefined

  const createOnCheckHandler = (prop: keyof FilterState) => () =>
    dispatch({
      type: FilterActionType.TOGGLE_BOOLEAN,
      prop,
    })

  return (
    <>
      <div className="filters">
        <Checkbox
          checked={state.groupByResponsible}
          onCheck={createOnCheckHandler("groupByResponsible")}
        >
          Grupper etter ansvarlig (iht.{" "}
          <a href="https://github.com/capralifecycle/resources-definition">
            resources-definition
          </a>
          )
        </Checkbox>
        <Checkbox
          checked={state.showDepList}
          onCheck={createOnCheckHandler("showDepList")}
        >
          Vis detaljert liste over oppdateringer
        </Checkbox>
        <input
          type="text"
          value={filterDepName}
          onChange={(e) => {
            setFilterDepName(e.target.value)
          }}
          placeholder="Filtrer på navn til oppdatering"
        />
        <Checkbox
          checked={state.showPrList}
          onCheck={createOnCheckHandler("showPrList")}
        >
          Vis liste over PRs
        </Checkbox>
        <Checkbox
          checked={state.showVulList}
          onCheck={createOnCheckHandler("showVulList")}
        >
          Vis detaljer om sårbarheter
        </Checkbox>
        <Checkbox
          checked={state.showOnlyActionable}
          onCheck={createOnCheckHandler("showOnlyActionable")}
        >
          Skjul repoer hvor alt er OK nå
        </Checkbox>
        <Checkbox
          checked={state.showOnlyVulnerable}
          onCheck={createOnCheckHandler("showOnlyVulnerable")}
        >
          Vis kun sårbare repoer
        </Checkbox>
        <Checkbox
          checked={limitGraphDays != null}
          onCheck={(checked) => setLimitGraphDays(checked ? limitDays : null)}
        >
          Begrens graf til siste 30 dager
        </Checkbox>
        <Checkbox
          checked={state.sortByRenovateDays}
          onCheck={createOnCheckHandler("sortByRenovateDays")}
        >
          Vis alle Renovate dager og sorter baklengs
        </Checkbox>
        <input
          type="text"
          value={filterRepoName}
          onChange={(e) => {
            setFilterRepoName(e.target.value)
          }}
          placeholder="Filtrer på navn til repo"
        />
      </div>
      {byResponsible != null ? (
        Object.entries(byResponsible)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([responsible, repos]) => {
            const collapsed = collapseResponsible.includes(responsible)

            return (
              <React.Fragment key={responsible}>
                <div className="responsible-heading">
                  <h2>Ansvarlig: {responsible}</h2>
                  <button
                    style={{ marginLeft: "5px" }}
                    onClick={() =>
                      collapsed
                        ? setCollapseResponsible(
                            collapseResponsible.filter(
                              (it) => it !== responsible,
                            ),
                          )
                        : setCollapseResponsible([
                            ...collapseResponsible,
                            responsible,
                          ])
                    }
                  >
                    {collapsed ? "Vis" : "Skjul"}
                  </button>
                </div>
                {!collapsed && (
                  <DataGroup
                    key={responsible}
                    fetchGroups={filterFetchGroupRepos(
                      filteredFetchGroups,
                      (it) => it.responsible === responsible,
                    )}
                    repos={repos}
                    showPrList={state.showPrList}
                    showDepList={state.showDepList}
                    showVulList={state.showVulList}
                    sortByRenovateDays={state.sortByRenovateDays}
                  />
                )}
              </React.Fragment>
            )
          })
      ) : (
        <>
          <h2 className="all-repos-heading">Alle repoer</h2>
          <DataGroup
            fetchGroups={filteredFetchGroups}
            repos={filteredRepos}
            showPrList={state.showPrList}
            showDepList={state.showDepList}
            showVulList={state.showVulList}
            sortByRenovateDays={state.sortByRenovateDays}
          />
        </>
      )}
    </>
  )
}

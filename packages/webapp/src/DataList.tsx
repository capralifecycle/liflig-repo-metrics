import type {
  WebappData,
  Repo,
} from "@liflig/repo-metrics-repo-collector-types"
import { groupBy } from "lodash-es"
import * as React from "react"
import { Checkbox } from "./Checkbox"
import { DataGroup } from "./DataGroup"
import type { Filter } from "./filter"
import { toQueryString } from "./filter"
import { FilterActionType, filterReducer } from "./filterReducer"
import { isActionableRepo, isVulnerableRepo } from "./Repo"

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

  const actionableRepos = state.showOnlyActionable
    ? data.repos.filter((it) => isActionableRepo(it.metrics)).map((it) => it.id)
    : []

  const vulnerableRepos = state.showOnlyVulnerable
    ? data.repos.filter((it) => isVulnerableRepo(it.metrics)).map((it) => it.id)
    : []

  function filterRepoId(repoId: string): boolean {
    return (
      (state.filterRepoName === "" ||
        repoId.toUpperCase().includes(state.filterRepoName.toUpperCase())) &&
      (!state.showOnlyActionable || actionableRepos.includes(repoId)) &&
      (!state.showOnlyVulnerable || vulnerableRepos.includes(repoId))
    )
  }

  function filterByUpdates(repo: Repo): boolean {
    return (
      state.filterUpdateName === "" ||
      (repo.metrics.github.availableUpdates?.some((category) =>
        category.updates.some((update) =>
          update.name.includes(state.filterUpdateName),
        ),
      ) ??
        false)
    )
  }

  function filterByVulnerabilities(repo: Repo): boolean {
    return (
      state.filterUpdateName === "" ||
      repo.metrics.github.vulnerabilityAlerts.some((alert) =>
        alert.packageName.includes(state.filterUpdateName),
      )
    )
  }

  const filteredRepos = data.repos
    .filter((it) => filterRepoId(it.id))
    .filter((it) => filterByUpdates(it) || filterByVulnerabilities(it))

  const byResponsible = state.groupByResponsible
    ? groupBy(filteredRepos, (it) => it.responsible ?? "Ukjent")
    : undefined

  const createOnCheckHandler = (prop: keyof Filter) => () =>
    dispatch({
      type: FilterActionType.TOGGLE_BOOLEAN,
      prop,
    })

  const removeMillisecondsFromTimestamp = (timestamp: string) => {
    const [yearMonthDay, restOfTimestamp] = timestamp.split("T")
    const hourMinuteSecond = restOfTimestamp.split(".")[0]
    return yearMonthDay + " " + hourMinuteSecond
  }

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
          value={state.filterUpdateName}
          onChange={(e) => {
            dispatch({
              type: FilterActionType.CHANGE_SEARCH_FILTER,
              prop: "filterUpdateName",
              payload: e.target.value,
            })
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
          checked={state.showOrgName}
          onCheck={createOnCheckHandler("showOrgName")}
        >
          Vis GitHub organisasjon
        </Checkbox>
        <Checkbox
          checked={state.showOnlyVulnerable}
          onCheck={createOnCheckHandler("showOnlyVulnerable")}
        >
          Vis kun sårbare repoer
        </Checkbox>
        <Checkbox
          checked={state.sortByRenovateDays}
          onCheck={createOnCheckHandler("sortByRenovateDays")}
        >
          Vis alle Renovate dager og sorter baklengs
        </Checkbox>
        <input
          type="text"
          value={state.filterRepoName}
          onChange={(e) => {
            dispatch({
              type: FilterActionType.CHANGE_SEARCH_FILTER,
              prop: "filterRepoName",
              payload: e.target.value,
            })
          }}
          placeholder="Filtrer på navn til repo"
        />
      </div>
      <p>
        Sist hentet fra kilder:{" "}
        {removeMillisecondsFromTimestamp(data.collectedAt)}
      </p>
      <p>
        Sist prosessert: {removeMillisecondsFromTimestamp(data.aggregatedAt)}
      </p>
      {byResponsible != null ? (
        Object.entries(byResponsible)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([responsible, repos]) => {
            const collapsed = state.collapseResponsible.includes(responsible)

            return (
              <React.Fragment key={responsible}>
                <div className="responsible-heading">
                  <h2>Ansvarlig: {responsible}</h2>
                  <button
                    style={{ marginLeft: "5px" }}
                    onClick={() =>
                      dispatch({
                        type: FilterActionType.TOGGLE_COLLAPSE_RESPONSIBLE,
                        prop: "collapseResponsible",
                        payload: responsible,
                      })
                    }
                  >
                    {collapsed ? "Vis" : "Skjul"}
                  </button>
                </div>
                {!collapsed && (
                  <DataGroup
                    key={responsible}
                    repos={repos}
                    showPrList={state.showPrList}
                    showDepList={state.showDepList}
                    showVulList={state.showVulList}
                    showOrgName={state.showOrgName}
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
            repos={filteredRepos}
            showPrList={state.showPrList}
            showDepList={state.showDepList}
            showVulList={state.showVulList}
            showOrgName={state.showOrgName}
            sortByRenovateDays={state.sortByRenovateDays}
          />
        </>
      )}
    </>
  )
}

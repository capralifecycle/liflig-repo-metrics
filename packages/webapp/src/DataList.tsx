import {
  WebappMetricData,
  WebappMetricDataRepo,
  WebappStatsByFetchGroup,
} from "@liflig/repo-metrics-repo-collector-types"
import { groupBy } from "lodash"
import * as React from "react"
import { Checkbox } from "./Checkbox"
import { DataGroup } from "./DataGroup"
import { Filter, toQueryString } from "./filter"
import { FilterActionType, filterReducer } from "./filterReducer"
import { isActionableRepo, isVulnerableRepo } from "./Repo"

interface Props {
  data: WebappMetricData
  filter: Filter
}

function ageInDays(timestamp: string) {
  // Approx to simplify.
  const secondsPerDay = 86400000
  return Math.floor(
    (new Date().getTime() - new Date(timestamp).getTime()) / secondsPerDay,
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

export const DataList: React.FC<Props> = ({ data, filter }) => {
  const [state, dispatch] = React.useReducer(filterReducer, filter)

  React.useEffect(() => {
    const queryString = toQueryString(state)
    history.replaceState(state, "", queryString ? `?${queryString}` : "/")
  }, [state])

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
      (state.filterRepoName === "" || repoId.includes(state.filterRepoName)) &&
      (!state.showOnlyActionable || actionableRepos.includes(repoId)) &&
      (!state.showOnlyVulnerable || vulnerableRepos.includes(repoId))
    )
  }

  function filterByUpdates(repo: WebappMetricDataRepo): boolean {
    return (
      state.filterUpdateName === "" ||
      (repo.lastDatapoint.github.availableUpdates?.some((category) =>
        category.updates.some((update) =>
          update.name.includes(state.filterUpdateName),
        ),
      ) ??
        false)
    )
  }

  function filterByVulnerabilities(repo: WebappMetricDataRepo): boolean {
    return (
      state.filterUpdateName === "" ||
      repo.lastDatapoint.github.vulnerabilityAlerts.some((alert) =>
        alert.packageName.includes(state.filterUpdateName),
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
        state.limitGraphDays == false ||
        ageInDays(it.timestamp) < state.numberOfGraphDaysToLimit,
    ),
    (it) => shownRepoIds.includes(it.repoId),
  )

  const byResponsible = state.groupByResponsible
    ? groupBy(filteredRepos, (it) => it.responsible ?? "Ukjent")
    : undefined

  const createOnCheckHandler = (prop: keyof Filter) => () =>
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
          checked={state.showOnlyVulnerable}
          onCheck={createOnCheckHandler("showOnlyVulnerable")}
        >
          Vis kun sårbare repoer
        </Checkbox>
        <Checkbox
          checked={state.limitGraphDays != false}
          onCheck={(checked) => {
            dispatch({
              type: FilterActionType.TOGGLE_BOOLEAN,
              prop: "limitGraphDays",
            })
          }}
        >
          <span>
            Begrens graf til siste{" "}
            <input
              className="num-days-input"
              inputMode="numeric"
              value={state.numberOfGraphDaysToLimit}
              onInput={(inputEvent) => {
                console.log(inputEvent)
                dispatch({
                  type: FilterActionType.CHANGE_NUMBER_OF_DAYS,
                  prop: "numberOfGraphDaysToLimit",
                  // @ts-expect-error: faulty ts definition stops us from accessing a value that does exist
                  payload: inputEvent.target.value as string,
                })
              }}
            ></input>{" "}
            dager
          </span>
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
	      payload: e.target.value
            })
          }}
          placeholder="Filtrer på navn til repo"
        />
      </div>
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

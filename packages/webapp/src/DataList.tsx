import {
  WebappMetricData,
  WebappStatsByFetchGroup,
} from "@liflig/repo-metrics-repo-collector-types"
import { groupBy } from "lodash"
import * as React from "react"
import { Checkbox } from "./Checkbox"
import { DataGroup } from "./DataGroup"
import { isActionableRepo, isVulnerableRepo } from "./Repo"

interface Props {
  data: WebappMetricData
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

export const DataList: React.FC<Props> = ({ data }) => {
  const limitDays = 20

  const [groupByResponsible, setGroupByResponsible] = React.useState(true)
  const [showPrList, setShowPrList] = React.useState(false)
  const [showDepList, setShowDepList] = React.useState(false)
  const [showVulList, setShowVulList] = React.useState(false)
  const [showOnlyActionable, setShowOnlyActionable] = React.useState(false)
  const [showOnlyVulnerable, setShowOnlyVulnerable] = React.useState(false)
  const [limitGraphDays, setLimitGraphDays] = React.useState<number | null>(
    limitDays,
  )
  const [sortByRenovateDays, setSortByRenovateDays] = React.useState(false)
  const [filterRepoName, setFilterRepoName] = React.useState("")

  const [collapseResponsible, setCollapseResponsible] = React.useState<
    string[]
  >([])

  const actionableRepos = showOnlyActionable
    ? data.repos
        .filter((it) => isActionableRepo(it.lastDatapoint))
        .map((it) => it.repoId)
    : []

  const vulnerableRepos = showOnlyVulnerable
    ? data.repos
        .filter((it) => isVulnerableRepo(it.lastDatapoint))
        .map((it) => it.repoId)
    : []

  function filterRepoId(repoId: string): boolean {
    return (
      (filterRepoName === "" || repoId.includes(filterRepoName)) &&
      (!showOnlyActionable || actionableRepos.includes(repoId)) &&
      (!showOnlyVulnerable || vulnerableRepos.includes(repoId))
    )
  }

  const filteredRepos = data.repos.filter((it) => filterRepoId(it.repoId))

  const filteredFetchGroups = filterFetchGroupRepos(
    data.byFetchGroup.filter(
      (it) =>
        limitGraphDays == null || ageInDays(it.timestamp) < limitGraphDays,
    ),
    (it) => filterRepoId(it.repoId),
  )

  const byResponsible = groupByResponsible
    ? groupBy(filteredRepos, (it) => it.responsible ?? "Ukjent")
    : undefined

  return (
    <>
      <Checkbox checked={groupByResponsible} onCheck={setGroupByResponsible}>
        Grupper etter ansvarlig (iht.{" "}
        <a href="https://github.com/capralifecycle/resources-definition">
          resources-definition
        </a>
        )
      </Checkbox>
      <Checkbox checked={showDepList} onCheck={setShowDepList}>
        Vis detaljert liste over avhengigheter
      </Checkbox>
      <Checkbox checked={showPrList} onCheck={setShowPrList}>
        Vis liste over PRs
      </Checkbox>
      <Checkbox checked={showVulList} onCheck={setShowVulList}>
        Vis detaljer om sårbarheter
      </Checkbox>
      <Checkbox checked={showOnlyActionable} onCheck={setShowOnlyActionable}>
        Skjul repoer hvor alt er OK nå
      </Checkbox>
      <Checkbox checked={showOnlyVulnerable} onCheck={setShowOnlyVulnerable}>
        Vis kun sårbare repoer
      </Checkbox>
      <Checkbox
        checked={limitGraphDays != null}
        onCheck={(checked) => setLimitGraphDays(checked ? limitDays : null)}
      >
        Begrens graf til siste 20 dager
      </Checkbox>
      <Checkbox checked={sortByRenovateDays} onCheck={setSortByRenovateDays}>
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
      {byResponsible != null ? (
        Object.entries(byResponsible)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([responsible, repos]) => {
            const collapsed = collapseResponsible.includes(responsible)

            return (
              <React.Fragment key={responsible}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <h2>Ansvarlig: {responsible}</h2>
                  <p style={{ paddingLeft: "5px" }}>
                    <button
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
                  </p>
                </div>
                {!collapsed && (
                  <DataGroup
                    key={responsible}
                    fetchGroups={filterFetchGroupRepos(
                      filteredFetchGroups,
                      (it) => it.responsible === responsible,
                    )}
                    repos={repos}
                    showPrList={showPrList}
                    showDepList={showDepList}
                    showVulList={showVulList}
                    sortByRenovateDays={sortByRenovateDays}
                  />
                )}
              </React.Fragment>
            )
          })
      ) : (
        <>
          <h2>Alle repoer</h2>
          <DataGroup
            fetchGroups={filteredFetchGroups}
            repos={filteredRepos}
            showPrList={showPrList}
            showDepList={showDepList}
            showVulList={showVulList}
            sortByRenovateDays={sortByRenovateDays}
          />
        </>
      )}
    </>
  )
}

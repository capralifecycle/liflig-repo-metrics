import { WebappMetricData } from "@liflig/repo-metrics-repo-collector-types"
import { groupBy } from "lodash"
import * as React from "react"
import { Checkbox } from "./Checkbox"
import { DataGroup } from "./DataGroup"

interface Props {
  data: WebappMetricData
}

export const DataList: React.FC<Props> = ({ data }) => {
  const limitDays = 20

  const [showPrList, setShowPrList] = React.useState(false)
  const [showDepList, setShowDepList] = React.useState(false)
  const [showVulList, setShowVulList] = React.useState(false)
  const [limitGraphDays, setLimitGraphDays] = React.useState<number | null>(
    limitDays,
  )
  const [filterRepoName, setFilterRepoName] = React.useState("")

  const filteredRepos = data.repos.filter(
    (it) => filterRepoName === "" || it.repoId.includes(filterRepoName),
  )

  const filteredFetchGroups = data.byFetchGroup.flatMap((it) => {
    const repos = it.repos.filter(
      (it) => filterRepoName === "" || it.repoId.includes(filterRepoName),
    )

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

  const byResponsible = groupBy(
    filteredRepos,
    (it) => it.responsible ?? "Ukjent",
  )

  return (
    <>
      <Checkbox checked={showDepList} onCheck={setShowDepList}>
        Vis detaljert liste over avhengigheter
      </Checkbox>
      <Checkbox checked={showPrList} onCheck={setShowPrList}>
        Vis liste over PRs
      </Checkbox>
      <Checkbox checked={showVulList} onCheck={setShowVulList}>
        Vis detaljert detaljer om sårbarheter
      </Checkbox>
      <Checkbox
        checked={limitGraphDays != null}
        onCheck={(checked) => setLimitGraphDays(checked ? limitDays : null)}
      >
        Begrens graf til siste 20 dager
      </Checkbox>
      <input
        type="text"
        value={filterRepoName}
        onChange={(e) => {
          setFilterRepoName(e.target.value)
        }}
        placeholder="Filtrer på navn til repo"
      />
      {Object.entries(byResponsible)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([responsible, repos]) => (
          <DataGroup
            key={responsible}
            fetchGroups={filteredFetchGroups}
            responsible={responsible}
            repos={repos}
            showPrList={showPrList}
            showDepList={showDepList}
            showVulList={showVulList}
            limitGraphDays={limitGraphDays}
          />
        ))}
    </>
  )
}

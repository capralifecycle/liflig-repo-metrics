import { WebappMetricData } from "@liflig/repo-metrics-repo-collector-types"
import { groupBy } from "lodash"
import * as React from "react"
import { Checkbox } from "./Checkbox"
import { DataGroup } from "./DataGroup"

interface Props {
  data: WebappMetricData
}

export const DataList: React.FC<Props> = ({ data }) => {
  const byResponsible = groupBy(data.repos, (it) => it.responsible ?? "Ukjent")

  const limitDays = 20

  const [showPrList, setShowPrList] = React.useState(false)
  const [showDepList, setShowDepList] = React.useState(false)
  const [showVulList, setShowVulList] = React.useState(false)
  const [limitGraphDays, setLimitGraphDays] = React.useState<number | null>(
    limitDays,
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
      {Object.entries(byResponsible)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([responsible, repos]) => (
          <DataGroup
            key={responsible}
            data={data}
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

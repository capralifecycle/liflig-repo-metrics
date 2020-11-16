import { WebappMetricData } from "@liflig/repo-metrics-repo-collector-types"
import { groupBy } from "lodash"
import * as React from "react"
import { DataGroup } from "./DataGroup"

interface Props {
  data: WebappMetricData
}

export const DataList: React.FC<Props> = ({ data }) => {
  const byResponsible = groupBy(data.repos, (it) => it.responsible ?? "Ukjent")

  const [showDepList, setShowDepList] = React.useState(false)
  const [showVulList, setShowVulList] = React.useState(false)

  return (
    <>
      <p>
        <label>
          <input
            type="checkbox"
            checked={showDepList}
            onChange={(e) => setShowDepList(e.target.checked)}
          />{" "}
          Vis detaljert liste over avhengigheter
        </label>
      </p>
      <p>
        <label>
          <input
            type="checkbox"
            checked={showVulList}
            onChange={(e) => setShowVulList(e.target.checked)}
          />{" "}
          Vis detaljert detaljer om sårbarheter
        </label>
      </p>
      {Object.entries(byResponsible)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([responsible, repos]) => (
          <DataGroup
            key={responsible}
            responsible={responsible}
            repos={repos}
            showDepList={showDepList}
            showVulList={showVulList}
          />
        ))}
    </>
  )
}

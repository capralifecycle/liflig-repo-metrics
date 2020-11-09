import { MetricRepoSnapshot } from "@liflig/repo-metrics-repo-collector-types"
import { groupBy } from "lodash"
import * as React from "react"
import _data from "../../repo-collector/result.json"

const responsible = "team-fnf"

// TODO: Fix conversion when data is updated. Load from URL.
const data: MetricRepoSnapshot[] = (_data as unknown) as MetricRepoSnapshot[]

const dataByRepo = groupBy(data, (it) => it.repoId)

const Repo = ({ items }: { items: MetricRepoSnapshot[] }) => {
  const details = items[0]

  return <li>{details.repoId}</li>
}

const App: React.FC = () => (
  <>
    <h1>Repos</h1>
    <ul>
      {Object.entries(dataByRepo).map(([repoId, items]) => (
        <Repo key={repoId} items={items} />
      ))}
    </ul>
  </>
)

export default App

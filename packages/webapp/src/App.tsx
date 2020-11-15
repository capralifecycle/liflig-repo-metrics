import { MetricRepoSnapshot } from "@liflig/repo-metrics-repo-collector-types"
import { groupBy } from "lodash"
import * as React from "react"

function useData(): [boolean, MetricRepoSnapshot[] | null] {
  const [data, setData] = React.useState<MetricRepoSnapshot[] | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    setIsLoading(true)
    fetch("/data/result.json")
      .then((it) => it.json())
      .then((it) => {
        setData(it)
      })
      .catch((e) => {
        console.log("Fetching result.json failed", e)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  return [isLoading, data]
}

const responsible = "team-fnf"

const Repo = ({ items }: { items: MetricRepoSnapshot[] }) => {
  const details = items[0]

  return <li>{details.repoId}</li>
}

const App: React.FC = () => {
  const [dataIsLoading, data] = useData()

  const dataByRepo = React.useMemo(
    () => (data == null ? null : groupBy(data, (it) => it.repoId)),
    [data],
  )

  return (
    <>
      <h1>Repos</h1>
      {dataIsLoading ? (
        <p>Laster data...</p>
      ) : !dataByRepo ? (
        <p>Klarte ikke å laste inn data.</p>
      ) : (
        <ul>
          {Object.entries(dataByRepo).map(([repoId, items]) => (
            <Repo key={repoId} items={items} />
          ))}
        </ul>
      )}
    </>
  )
}

export default App

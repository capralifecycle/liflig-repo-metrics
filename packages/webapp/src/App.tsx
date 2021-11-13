import * as React from "react"
import { useData } from "./data"
import { DataList, FilterState } from "./DataList"

const App: React.FC = () => {
  const { isLoading: dataIsLoading, data } = useData()
  const defaultValues: FilterState = {
    showPrList: false,
    showDepList: false,
    showVulList: false,
    groupByResponsible: true,
    showOnlyActionable: false,
    showOnlyVulnerable: false,
    sortByRenovateDays: false,
  }
  const [filterState, setFilterstate] = React.useState(defaultValues)

  React.useEffect(() => {
    const filterStateFromUrl = location.search
      .slice(1)
      .split("&")
      .map((s) => s.split("="))
      .reduce((acc, [k, v]) => {
        acc[k] = v === "true"
        return acc
      }, filterState)

    setFilterstate(filterStateFromUrl)
  }, [])

  return (
    <>
      <div style={{ display: "flex", alignItems: "center" }}>
        <h1>Repo metrics</h1>
        <a
          href="https://github.com/capralifecycle/liflig-repo-metrics"
          style={{ marginLeft: "5px" }}
        >
          GitHub
        </a>
      </div>
      {dataIsLoading ? (
        <p>Laster data...</p>
      ) : !data ? (
        <p>Klarte ikke å laste inn data.</p>
      ) : (
        <DataList data={data} filterState={filterState} />
      )}
    </>
  )
}

export default App

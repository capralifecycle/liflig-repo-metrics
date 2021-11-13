import * as React from "react"
import { useData } from "./data"
import { DataList } from "./DataList"
import { defaultValues, getFilterStateFromUrl } from "./filter"

const App: React.FC = () => {
  const { isLoading: dataIsLoading, data } = useData()

  const [filterState, setFilterstate] = React.useState(defaultValues)

  React.useEffect(() => {
    setFilterstate(getFilterStateFromUrl())
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

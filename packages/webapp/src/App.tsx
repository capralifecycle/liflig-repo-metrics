import * as React from "react"
import { useData } from "./data"
import { DataList } from "./DataList"
import { defaultValues, getFilterFromUrl } from "./filter"

const App: React.FC = () => {
  const { isLoading: dataIsLoading, data } = useData()

  const [filter, setFilter] = React.useState(defaultValues)

  React.useEffect(() => {
    const initialFilter = getFilterFromUrl()
    setFilter(initialFilter)
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
        <DataList data={data} filter={filter} />
      )}
    </>
  )
}

export default App

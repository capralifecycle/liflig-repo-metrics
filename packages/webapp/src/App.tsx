import * as React from "react"
import { useData } from "./data"
import { DataList } from "./DataList"

const App: React.FC = () => {
  const { isLoading: dataIsLoading, data } = useData()

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
        <DataList data={data} />
      )}
    </>
  )
}

export default App

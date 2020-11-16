import * as React from "react"
import { useData } from "./data"
import { DataList } from "./DataList"

const App: React.FC = () => {
  const { isLoading: dataIsLoading, data } = useData()

  return (
    <>
      <h1>Repos</h1>
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

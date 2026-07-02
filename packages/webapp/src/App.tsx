import * as React from "react"
import { DataList } from "./DataList"
import { useData } from "./data"
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
      {dataIsLoading ? (
        <p>Loading data...</p>
      ) : !data ? (
        <p>Failed to load data</p>
      ) : (
        <DataList data={data} filter={filter} />
      )}
    </>
  )
}

export default App

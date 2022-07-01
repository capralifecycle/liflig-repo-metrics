import * as React from "react"
import { useData } from "./data"
import { DataList } from "./DataList"
import { ReloadButton } from "./ReloadButton"
import { defaultValues, getFilterFromUrl } from "./filter"
import { WebappMetricData } from "@liflig/repo-metrics-repo-collector-types"

const App: React.FC = () => {
  const { isLoading: dataIsLoading, data } = useData()

  const [filter, setFilter] = React.useState(defaultValues)

  React.useEffect(() => {
    const initialFilter = getFilterFromUrl()
    setFilter(initialFilter)
  }, [])

  const dataUpdateHandler = () => {
    console.log("now we should update the data!")
  }

  return (
    <>
      {dataIsLoading ? (
        <p>Laster data...</p>
      ) : !data ? (
        <p>Klarte ikke å laste inn data.</p>
      ) : (
        <div>
          <ReloadButton
            mostRecentDataTimestamp={findMostRecentTimestamp(data)}
            updateCallback={dataUpdateHandler}
          ></ReloadButton>
          <DataList data={data} filter={filter} />
        </div>
      )}
    </>
  )
}

const findMostRecentTimestamp = (data: WebappMetricData) => {
  const mostRecentMetric = data.byFetchGroup.reduce((memo, current) => {
    const memoDate = new Date(memo.timestamp)
    const currentDate = new Date(current.timestamp)

    return memoDate > currentDate ? memo : current
  })

  return mostRecentMetric.timestamp
}

export default App

import type { WebappData } from "@liflig/repo-metrics-repo-collector-types"
import * as React from "react"

export function useData(): {
  isLoading: boolean
  data: WebappData | null
} {
  const [data, setData] = React.useState<WebappData | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    setIsLoading(true)
    fetch("/data/webapp.json")
      .then((it) => it.json())
      .then((it: WebappData) => {
        setData(it)
      })
      .catch((e) => {
        console.log("Fetching webapp.json failed", e)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  return {
    isLoading,
    data,
  }
}

import _ from "lodash"

export interface Filter
  extends Record<string, boolean | string | string[] | number> {
  showPrList: boolean
  showDepList: boolean
  showVulList: boolean
  groupByResponsible: boolean
  showOnlyActionable: boolean
  showOnlyVulnerable: boolean
  sortByRenovateDays: boolean
  collapseResponsible: string[]
  filterRepoName: string
  filterUpdateName: string
  limitGraphDays: boolean
  numberOfGraphDaysToLimit: number
}

export const defaultValues: Filter = {
  showPrList: false,
  showDepList: false,
  showVulList: false,
  groupByResponsible: true,
  showOnlyActionable: false,
  showOnlyVulnerable: false,
  sortByRenovateDays: false,
  collapseResponsible: [],
  filterRepoName: "",
  filterUpdateName: "",
  limitGraphDays: false,
  numberOfGraphDaysToLimit: 30,
}

// Parse URL parameters and turn into a filter object.
// Any parameter not specified in the URL assumes a default value
export const getFilterFromUrl = (): Filter =>
  location.search
    .slice(1)
    .split("&")
    .map((s) => s.split("="))
    .reduce(
      (acc, [k, v]) => Object.assign(acc, parseUrlFilterField(k, v)),
      Object.assign({}, defaultValues),
    )

const parseUrlFilterField = (key: string, value: string) => {
  const keyValueFields = [
    "filterRepoName",
    "filterUpdateName",
    "limitGraphDays",
  ]

  // The collapseResponsible attribute can contain multiple comma separated values,
  // and needs special handling during parsing
  if (key == "collapseResponsible") {
    return {
      [key]: value.split(","),
    }
  }

  // Attributes with only one value
  else if (keyValueFields.includes(key)) {
    return {
      [key]: value,
    }
  }

  // Boolean attributes
  else {
    return {
      [key]: true,
    }
  }
}

export const toQueryString = (state: Filter): string => {
  return Object.keys(defaultValues)
    .filter((k) => !_.isEqual(defaultValues[k], state[k]))
    .map((k) => {
      if (state[k] == null) {
        return ""
      }

      let curParamValue = state[k]
      // Show the number of days to limit in url, not just the toggle value
      if (k === "limitGraphDays") {
        curParamValue = state["numberOfGraphDaysToLimit"]
      }
      return `${k}=${curParamValue.toString()}`
    })
    .join("&")
}

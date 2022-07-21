import _ from "lodash"

export interface Filter extends Record<string, boolean | string | string[]> {
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
  filterUpdateName: ""
}

export const getFilterFromUrl = (): Filter =>
  location.search
    .slice(1)
    .split("&")
    .map((s) => s.split("="))
    .reduce(
      (acc, [k, v]) =>
        Object.assign(
          acc, parseUrlFilterField(k, v)
        ),
      Object.assign({}, defaultValues),
    )

const parseUrlFilterField = (key: string, value: string) => {
  if (key == "collapseResponsible") {
    return {
      [key]: value.split(",")
    }
  }
  else if (key == "filterRepoName" || key == "filterUpdateName") {
    return {
      [key]: value
    }
  }
  else {
    return {
      [key]: true
    }
  }
}


export const toQueryString = (state: Filter): string => {
  return Object.keys(defaultValues)
    .filter((k) => !_.isEqual(defaultValues[k], state[k]))
    .map((k) => `${k}=${state[k].toString()}`)
    .join("&")
}

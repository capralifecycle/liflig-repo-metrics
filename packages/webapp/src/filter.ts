import { isEqual } from "lodash-es"

export interface Filter
  extends Record<string, boolean | string | string[] | number> {
  showPrList: boolean
  showDepList: boolean
  showVulList: boolean
  showOrgName: boolean
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
  showOrgName: false,
  groupByResponsible: true,
  showOnlyActionable: false,
  showOnlyVulnerable: false,
  sortByRenovateDays: false,
  collapseResponsible: [],
  filterRepoName: "",
  filterUpdateName: "",
}

// Parse URL parameters and turn into a filter object.
// Any parameter not specified in the URL assumes a default value
export const getFilterFromUrl = (): Filter => {
  const newFilter = location.search
    .slice(1)
    .split("&")
    .map((s) => s.split("="))
    .reduce(
      (acc, [k, v]) => Object.assign(acc, parseUrlFilterField(k, v)),
      Object.assign({}, defaultValues),
    )

  console.log(newFilter)

  return newFilter
}

const parseUrlFilterField = (key: string, value: string) => {
  const keyValueFields = ["filterRepoName", "filterUpdateName"]

  // The collapseResponsible attribute can contain multiple comma separated values,
  // and needs special handling during parsing
  if (key === "collapseResponsible") {
    return {
      [key]: value.split(","),
    }
  }

  // Attributes with only one value
  if (keyValueFields.includes(key)) {
    return {
      [key]: value,
    }
  }

  // Boolean attributes

  return {
    [key]: true,
  }
}

export const toQueryString = (state: Filter): string => {
  return Object.keys(defaultValues)
    .filter((k) => !isEqual(defaultValues[k], state[k]))
    .map((k) => {
      const curParamValue = state[k]
      return `${k}=${curParamValue.toString()}`
    })
    .join("&")
}

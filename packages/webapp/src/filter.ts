import { isEqual } from "lodash-es"

export const ENABLE_SORT_BY_RENOVATE_DAYS = false
export const ENABLE_GLOBAL_STATS = false

export interface Filter
  extends Record<string, boolean | string | string[] | number> {
  showPrList: boolean
  showBotPrList: boolean
  showDepList: boolean
  showVulGithubList: boolean
  showVulSnykList: boolean
  showOrgName: boolean
  showOnlyWithPrs: boolean
  showOnlyWithBotPrs: boolean
  showOnlyWithGithubVul: boolean
  showOnlyWithSnykVul: boolean
  sortByRenovateDays: boolean
  selectedTeams: string[]
  filterRepoName: string
  filterUpdateName: string
  filterVulName: string
  groupBy: "responsible" | "system"
}

export const defaultValues: Filter = {
  showPrList: false,
  showBotPrList: false,
  showDepList: false,
  showVulGithubList: false,
  showVulSnykList: false,
  showOrgName: false,
  showOnlyWithPrs: false,
  showOnlyWithBotPrs: false,
  showOnlyWithGithubVul: false,
  showOnlyWithSnykVul: false,
  sortByRenovateDays: false,
  selectedTeams: [],
  filterRepoName: "",
  filterUpdateName: "",
  filterVulName: "",
  groupBy: "responsible",
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

  return newFilter
}

const parseUrlFilterField = (key: string, value: string) => {
  const keyValueFields = [
    "filterRepoName",
    "filterUpdateName",
    "filterVulName",
    "groupBy",
  ]

  if (key === "selectedTeams") {
    return {
      [key]: value.split(",").filter(Boolean),
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

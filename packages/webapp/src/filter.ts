export interface FilterState extends Record<string, boolean> {
  showPrList: boolean
  showDepList: boolean
  showVulList: boolean
  groupByResponsible: boolean
  showOnlyActionable: boolean
  showOnlyVulnerable: boolean
  sortByRenovateDays: boolean
}

export const defaultValues: FilterState = {
  showPrList: false,
  showDepList: false,
  showVulList: false,
  groupByResponsible: true,
  showOnlyActionable: false,
  showOnlyVulnerable: false,
  sortByRenovateDays: false,
}

export const getFilterStateFromUrl = (): FilterState =>
  location.search
    .slice(1)
    .split("&")
    .map((s) => s.split("="))
    .reduce(
      (acc, [k, v]) => Object.assign(acc, { [k]: v === "true" }),
      Object.assign({}, defaultValues),
    )

export const toQueryString = (state: FilterState): string =>
  Object.keys(defaultValues)
    .filter((k) => defaultValues[k] !== state[k])
    .map((k) => `${k}=${state[k].toString()}`)
    .join("&")

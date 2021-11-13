export interface Filter extends Record<string, boolean> {
  showPrList: boolean
  showDepList: boolean
  showVulList: boolean
  groupByResponsible: boolean
  showOnlyActionable: boolean
  showOnlyVulnerable: boolean
  sortByRenovateDays: boolean
}

export const defaultValues: Filter = {
  showPrList: false,
  showDepList: false,
  showVulList: false,
  groupByResponsible: true,
  showOnlyActionable: false,
  showOnlyVulnerable: false,
  sortByRenovateDays: false,
}

export const getFilterFromUrl = (): Filter =>
  location.search
    .slice(1)
    .split("&")
    .map((s) => s.split("="))
    .reduce(
      (acc, [k, v]) => Object.assign(acc, { [k]: v === "true" }),
      Object.assign({}, defaultValues),
    )

export const toQueryString = (state: Filter): string =>
  Object.keys(defaultValues)
    .filter((k) => defaultValues[k] !== state[k])
    .map((k) => `${k}=${state[k].toString()}`)
    .join("&")

import type { Filter } from "./filter"

export enum FilterActionType {
  TOGGLE_BOOLEAN = "toggle_boolean",
  TOGGLE_TEAM = "toggle_team",
  SET_TEAMS = "set_teams",
  CHANGE_SEARCH_FILTER = "change_search_filter",
  CHANGE_NUMBER_OF_DAYS = "change_number_of_days",
  SET_BOOLEANS = "set_booleans",
  SET_GROUP_BY = "set_group_by",
}

interface FilterAction<T = keyof Filter> {
  type: FilterActionType
  prop: T
  payload?: string
}

export function filterReducer(state: Filter, action: FilterAction): Filter {
  switch (action.type) {
    case FilterActionType.TOGGLE_BOOLEAN:
      return { ...state, [action.prop]: !state[action.prop] }

    case FilterActionType.CHANGE_NUMBER_OF_DAYS: {
      const newValue = action.payload
      if (newValue !== undefined && isValidNumberOfDays(newValue)) {
        return { ...state, [action.prop]: newValue }
      }
      return state
    }

    case FilterActionType.TOGGLE_TEAM: {
      const team = action.payload
      if (!team) return state
      const prev = state.selectedTeams
      const selectedTeams = prev.includes(team)
        ? prev.filter((it) => it !== team)
        : [...prev, team]
      return { ...state, selectedTeams }
    }
    case FilterActionType.SET_TEAMS: {
      const teams = action.payload ? action.payload.split(",") : []
      return { ...state, selectedTeams: teams }
    }

    case FilterActionType.SET_BOOLEANS: {
      const props = (action.payload ?? "").split(",")
      const value = action.prop === "true"
      const updates = Object.fromEntries(props.map((p) => [p, value]))
      return { ...state, ...updates }
    }

    case FilterActionType.CHANGE_SEARCH_FILTER: {
      // Null check
      if (action.payload === null || action.payload === undefined) return state

      // Non-null search filter values update filter state
      const newFilterValue: string = action.payload
      const newFilterState = {
        ...state,
        [action.prop]: newFilterValue,
      }
      return newFilterState
    }

    case FilterActionType.SET_GROUP_BY: {
      const value = action.payload as "responsible" | "system"
      return { ...state, groupBy: value }
    }

    default:
      throw new Error()
  }
}

const isValidNumberOfDays: (value: string) => boolean = (value) => {
  const numberValue = Number(value)
  return (
    !Number.isNaN(numberValue) &&
    Number.isInteger(numberValue) &&
    numberValue > 0
  )
}

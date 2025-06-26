import type { Filter } from "./filter"

export enum FilterActionType {
  TOGGLE_BOOLEAN = "toggle_boolean",
  TOGGLE_COLLAPSE_RESPONSIBLE = "toggle_collapse_responsible",
  CHANGE_SEARCH_FILTER = "change_search_filter",
  CHANGE_NUMBER_OF_DAYS = "change_number_of_days",
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

    case FilterActionType.TOGGLE_COLLAPSE_RESPONSIBLE: {
      const responsible = action.payload
      if (!responsible) return state
      const prev = state.collapseResponsible
      const collapseResponsible = prev.includes(responsible)
        ? prev.filter((it) => it !== responsible)
        : [...prev, responsible]

      return { ...state, collapseResponsible }
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

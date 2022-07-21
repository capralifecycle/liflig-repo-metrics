import { Filter } from "./filter"

export enum FilterActionType {
  TOGGLE_BOOLEAN = "toggle_boolean",
  TOGGLE_COLLAPSE_RESPONSIBLE = "toggle_collapse_responsible",
  CHANGE_SEARCH_FILTER = "change_search_filter"
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

      // If the contents of the filter is empty, leave state as it is
      if (action.payload === null || action.payload === "")
        return state

      // Otherwise, update filter state
      const newFilterValue: string = action.payload as string
      const newFilterState = {
        ...state, [action.prop]: newFilterValue
      }
      return newFilterState;
    }

    default:
      throw new Error()
  }
}

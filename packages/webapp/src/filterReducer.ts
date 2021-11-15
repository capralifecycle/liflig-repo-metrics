import { Filter } from "./filter"

export enum FilterActionType {
  TOGGLE_BOOLEAN = "toggle_boolean",
  TOGGLE_COLLAPSE_RESPONSIBLE = "toggle_collapse_responsible",
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
    default:
      throw new Error()
  }
}

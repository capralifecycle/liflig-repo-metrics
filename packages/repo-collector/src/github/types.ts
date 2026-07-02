export type Permission = "admin" | "push" | "pull"

export interface RenovateDependencyDashboardIssue {
  number: number
  body: string
  lastUpdatedByRenovate: string | null
}

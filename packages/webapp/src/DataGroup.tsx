import type { Repo } from "@liflig/repo-metrics-repo-collector-types"
import type * as React from "react"
import { repoColumns } from "./Repo"
import Table from "./Table"

interface Props {
  repos: Repo[]
  sortByRenovateDays: boolean
  filterRepoName: string
  filterUpdateName: string
  filterVulName: string
  selectedRepoId?: string
  onSelectRepo: (repo: Repo) => void
  compact?: boolean
}

export const DataGroup: React.FC<Props> = ({
  repos,
  sortByRenovateDays,
  filterRepoName,
  filterUpdateName,
  filterVulName,
  selectedRepoId,
  onSelectRepo,
  compact,
}) => {
  return (
    <>
      <div className={`repo-metrics-table-wrap${compact ? " compact" : ""}`}>
        <Table
          data={[...repos].sort((a, b) => {
            function compareByName() {
              return a.id.localeCompare(b.id)
            }
            if (sortByRenovateDays) {
              const aDays =
                a.metrics.github.renovateDependencyDashboard
                  ?.daysSinceLastUpdate
              const bDays =
                b.metrics.github.renovateDependencyDashboard
                  ?.daysSinceLastUpdate

              if (aDays != null && bDays != null) {
                if (aDays === bDays) return compareByName()
                if (aDays > bDays) return -1
                return 1
              }

              if (aDays != null || bDays != null) {
                if (aDays == null) return 1
                return -1
              }
            }
            return compareByName()
          })}
          rowKey={(repo) => repo.id}
          onRowClick={onSelectRepo}
          selectedKey={selectedRepoId}
          columns={repoColumns({
            filterRepoName,
            filterUpdateName,
            filterVulName,
            compact,
          })}
        />
      </div>
    </>
  )
}

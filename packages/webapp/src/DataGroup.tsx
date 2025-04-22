import type { Repo } from "@liflig/repo-metrics-repo-collector-types"
import { sumBy } from "lodash-es"
import * as React from "react"
import { repoColumns } from "./Repo"
import Table from "./Table"

interface Props {
  repos: Repo[]
  showPrList: boolean
  showDepList: boolean
  showVulList: boolean
  showOrgName: boolean
  sortByRenovateDays: boolean
}

export const DataGroup: React.FC<Props> = ({
  repos,
  showPrList,
  showDepList,
  showVulList,
  showOrgName,
  sortByRenovateDays,
}) => {
  const updatesAvailable = sumBy(
    repos,
    (it) =>
      (it.metrics.github.availableUpdates ?? []).flatMap((it) =>
        it.isActionable ? it.updates : [],
      ).length,
  )

  const githubAlerts = sumBy(
    repos,
    (it) => it.metrics.github.vulnerabilityAlerts.length,
  )

  const snykAlerts = sumBy(repos, (it) => it.metrics.snyk?.totalIssues ?? 0)

  return (
    <>
      <p>
        Status: {repos.length} repoer.{" "}
        <span style={{ color: "#28a745" }}>
          {updatesAvailable} oppdateringer
        </span>{" "}
        til behandling.{" "}
        <span style={{ color: "#cb2431" }}>
          {snykAlerts} sårbarheter (Snyk)
        </span>
        .{" "}
        <span style={{ color: "#663399" }}>
          {githubAlerts} sårbarheter (GitHub)
        </span>
        .
      </p>
      <div
        className="repo-metrics-table-wrap"
        style={{ display: "flex", justifyContent: "center" }}
      >
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
                if (aDays == bDays) return compareByName()
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
          columns={repoColumns({
            showPrList,
            showDepList,
            showVulList,
            showOrgName,
            showRenovateDays: sortByRenovateDays,
          })}
        />
      </div>
    </>
  )
}

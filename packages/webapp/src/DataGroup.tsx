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
      (it.lastDatapoint.github.availableUpdates ?? []).flatMap((it) =>
        it.isActionable ? it.updates : [],
      ).length,
  )

  const githubAlerts = sumBy(
    repos,
    (it) => it.lastDatapoint.github.vulnerabilityAlerts.length,
  )

  const snykAlerts = sumBy(
    repos,
    (it) => it.lastDatapoint.snyk?.totalIssues ?? 0,
  )

  const removeMillisecondsFromTimestamp = (timestamp: string) => {
    const [yearMonthDay, restOfTimestamp] = timestamp.split("T")
    const hourMinuteSecond = restOfTimestamp.split(".")[0]

    return yearMonthDay + " " + hourMinuteSecond
  }

  return (
    <>
      <p>
        Sist oppdatert{" "}
        {removeMillisecondsFromTimestamp(repos[0].lastDatapoint["timestamp"])}
      </p>
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
              return a.repoId.localeCompare(b.repoId)
            }
            if (sortByRenovateDays) {
              const aDays =
                a.lastDatapoint.github.renovateDependencyDashboard
                  ?.daysSinceLastUpdate
              const bDays =
                b.lastDatapoint.github.renovateDependencyDashboard
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

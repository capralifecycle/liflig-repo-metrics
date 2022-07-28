import {
  WebappMetricData,
  WebappMetricDataRepo,
} from "@liflig/repo-metrics-repo-collector-types"
import { sumBy } from "lodash"
import * as React from "react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Repo } from "./Repo"

interface Props {
  fetchGroups: WebappMetricData["byFetchGroup"]
  repos: WebappMetricDataRepo[]
  showPrList: boolean
  showDepList: boolean
  showVulList: boolean
  sortByRenovateDays: boolean
}

export const DataGroup: React.FC<Props> = ({
  fetchGroups,
  repos,
  showPrList,
  showDepList,
  showVulList,
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

  const minTime = Math.min(
    ...fetchGroups.map((it) => new Date(it.timestamp).getTime()),
  )
  const maxTime = Math.max(
    ...fetchGroups.map((it) => new Date(it.timestamp).getTime()),
  )

  const removeMillisecondsFromTimestamp = (timestamp: string) => {
    const [yearMonthDay, restOfTimestamp] = timestamp.split("T")
    const hourMinuteSecond = restOfTimestamp.split(".")[0]

    return yearMonthDay + " " + hourMinuteSecond
  }

  // Need to handle the case of no data
  if (fetchGroups.length < 1) {
    return (
      <ResponsiveContainer width="100%" height={170}>
        <h1>Ingen data å vise i dette tidsrommet</h1>
      </ResponsiveContainer>
    )
  }

  return (
    <>
      <ResponsiveContainer width="100%" height={170}>
        <LineChart
          data={fetchGroups.map((it) => ({
            timestamp: new Date(it.timestamp).getTime(),
            "snyk vulnerabilities": sumBy(
              it.repos,
              (r) => r.snykVulnerabilities,
            ),
            "github vulnerabilities": sumBy(
              it.repos,
              (r) => r.githubVulnerabilities,
            ),
            "available updates": sumBy(it.repos, (r) => r.updates),
          }))}
        >
          <CartesianGrid strokeDasharray="3 3" />
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */}
          <Tooltip labelFormatter={(it: any) => new Date(it).toISOString()} />
          <YAxis />
          <YAxis yAxisId="secondary" orientation="right" />
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={[minTime, maxTime]}
            tickFormatter={(it: number) =>
              new Date(it).toISOString().slice(0, 10)
            }
            minTickGap={20}
          />
          <Tooltip />
          <Legend />
          <Line
            dataKey="available updates"
            stroke="#28a745"
            strokeWidth={2}
            dot={{
              fill: "#28a745",
            }}
            isAnimationActive={false}
          />
          <Line
            dataKey="snyk vulnerabilities"
            stroke="#cb2431"
            strokeWidth={2}
            dot={{
              fill: "#cb2431",
            }}
            isAnimationActive={false}
          />
          <Line
            dataKey="github vulnerabilities"
            stroke="#663399"
            strokeWidth={2}
            dot={{
              fill: "#663399",
            }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p>
        Sist oppdatert{" "}
        {removeMillisecondsFromTimestamp(fetchGroups[0].timestamp)}
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
        <table style={{ width: "min(100%, 1500px)" }}>
          <thead>
            <tr>
              <th>Repo</th>
              <th>Oppdateringer til behandling</th>
              <th>Åpne PRs (bots)</th>
              <th>Åpne PRs (ikke bots)</th>
              <th>Sårbarheter (GitHub)</th>
              <th>Sårbarheter (Snyk)</th>
            </tr>
          </thead>
          <tbody>
            {[...repos]
              .sort((a, b) => {
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
              })
              .map((item) => (
                <Repo
                  key={item.repoId}
                  data={item}
                  showPrList={showPrList}
                  showDepList={showDepList}
                  showVulList={showVulList}
                  showRenovateDays={sortByRenovateDays}
                />
              ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

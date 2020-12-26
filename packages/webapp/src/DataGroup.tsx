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
  responsible: string
  repos: WebappMetricDataRepo[]
  showPrList: boolean
  showDepList: boolean
  showVulList: boolean
  limitGraphDays: number | null
}

export const DataGroup: React.FC<Props> = ({
  fetchGroups,
  responsible,
  repos,
  showPrList,
  showDepList,
  showVulList,
  limitGraphDays,
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

  function ageInDays(timestamp: string) {
    // Approx to simplify.
    return Math.floor(
      (new Date().getTime() - new Date(timestamp).getTime()) / 86400000,
    )
  }

  const filteredFetchGroups = fetchGroups
    .flatMap((fetchGroup) => {
      const repos = fetchGroup.repos.flatMap((it) =>
        it.responsible === responsible
          ? [{ ...it, timestamp: fetchGroup.timestamp }]
          : [],
      )

      if (repos.length === 0) {
        return []
      } else {
        return [
          {
            timestamp: fetchGroup.timestamp,
            repos,
          },
        ]
      }
    })
    .filter(
      (it) =>
        limitGraphDays == null || ageInDays(it.timestamp) < limitGraphDays,
    )

  const minTime = Math.min(
    ...filteredFetchGroups.map((it) => new Date(it.timestamp).getTime()),
  )
  const maxTime = Math.max(
    ...filteredFetchGroups.map((it) => new Date(it.timestamp).getTime()),
  )

  return (
    <>
      <h2>Ansvarlig: {responsible}</h2>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart
          data={filteredFetchGroups.map((it) => ({
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
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
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
            type="monotone"
            dataKey="available updates"
            stroke="#28a745"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="snyk vulnerabilities"
            stroke="#cb2431"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="github vulnerabilities"
            stroke="#663399"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p>
        Siste status: {repos.length} repoer. {updatesAvailable} oppdateringer
        til behandling. {githubAlerts} sårbarheter (GitHub). {snykAlerts}{" "}
        sårbarheter (Snyk)
      </p>
      <table>
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
            .sort((a, b) => a.repoId.localeCompare(b.repoId))
            .map((item) => (
              <Repo
                key={item.repoId}
                data={item}
                showPrList={showPrList}
                showDepList={showDepList}
                showVulList={showVulList}
              />
            ))}
        </tbody>
      </table>
    </>
  )
}

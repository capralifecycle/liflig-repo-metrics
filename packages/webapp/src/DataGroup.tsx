import {
  WebappMetricData,
  WebappMetricDataRepo,
} from "@liflig/repo-metrics-repo-collector-types"
import { sumBy } from "lodash"
import * as React from "react"
import { Repo } from "./Repo"

interface Props {
  data: WebappMetricData
  responsible: string
  repos: WebappMetricDataRepo[]
  showPrList: boolean
  showDepList: boolean
  showVulList: boolean
}

function sumSnyk(data: {
  countsBySeverity: {
    high: number
    medium: number
    low: number
  }
}): number {
  return (
    data.countsBySeverity.high +
    data.countsBySeverity.medium +
    data.countsBySeverity.low
  )
}

export const DataGroup: React.FC<Props> = ({
  data,
  responsible,
  repos,
  showPrList,
  showDepList,
  showVulList,
}) => {
  const updatesAvailable = sumBy(
    repos,
    (it) => (it.lastDatapoint.github.availableUpdates ?? []).length,
  )

  const githubAlerts = sumBy(
    repos,
    (it) => it.lastDatapoint.github.vulnerabilityAlerts.length,
  )

  const snykAlerts = sumBy(
    repos,
    (it) => it.lastDatapoint.snyk?.totalIssues ?? 0,
  )

  const fetchGroups = data.byFetchGroup.flatMap((fetchGroup) =>
    fetchGroup.byResponsible.flatMap((it) =>
      it.responsible === responsible
        ? [{ ...it, timestamp: fetchGroup.timestamp }]
        : [],
    ),
  )

  return (
    <>
      <h2>Ansvarlig: {responsible}</h2>
      <p>Datapunkter:</p>
      <ul>
        {fetchGroups.map((it) => (
          <li key={it.timestamp}>
            Tidspunkt: {it.timestamp} ({sumSnyk(it.snyk)} sårbarheter (Snyk),{" "}
            {it.availableUpdates} oppdateringer)
          </li>
        ))}
      </ul>
      <p>
        {updatesAvailable} oppdateringer tilgjengelig. {githubAlerts}{" "}
        sårbarheter (GitHub). {snykAlerts} sårbarheter (Snyk)
      </p>
      <table>
        <thead>
          <tr>
            <th>Repo</th>
            <th>Tid oppdatert</th>
            <th>Oppdateringer tilgjengelig</th>
            <th>Åpne PRs</th>
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

import { WebappMetricDataRepo } from "@liflig/repo-metrics-repo-collector-types"
import { sumBy } from "lodash"
import * as React from "react"
import { Repo } from "./Repo"

interface Props {
  responsible: string
  repos: WebappMetricDataRepo[]
  showDepList: boolean
  showVulList: boolean
}

export const DataGroup: React.FC<Props> = ({
  responsible,
  repos,
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

  return (
    <>
      <h2>Ansvarlig: {responsible}</h2>
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
                showDepList={showDepList}
                showVulList={showVulList}
              />
            ))}
        </tbody>
      </table>
    </>
  )
}

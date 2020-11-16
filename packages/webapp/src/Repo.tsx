import { WebappMetricDataRepo } from "@liflig/repo-metrics-repo-collector-types"
import * as React from "react"

interface Props {
  data: WebappMetricDataRepo
  showDepList: boolean
}

export const Repo: React.FC<Props> = ({ data, showDepList }) => {
  const availableUpdates = data.lastDatapoint.github.availableUpdates
  const githubVulAlerts = data.lastDatapoint.github.vulnerabilityAlerts

  return (
    <tr>
      <td>
        <a
          href={`https://github.com/${data.github.orgName}/${data.github.repoName}`}
        >
          {data.repoId}
        </a>
      </td>
      <td>{data.lastDatapoint.timestamp}</td>
      <td>
        {availableUpdates == null ? (
          <span style={{ color: "red" }}>Mangler Renovate</span>
        ) : availableUpdates.length === 0 ? (
          <span style={{ color: "green" }}>Alt oppdatert</span>
        ) : (
          <>
            <b>{availableUpdates.length}</b>
            {showDepList && (
              <ul>
                {availableUpdates.map((available) => (
                  <li key={available.name}>
                    {available.name} ({available.toVersion})
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </td>
      <td>
        {githubVulAlerts.length === 0 ? (
          <span style={{ color: "green" }}>Ingen</span>
        ) : (
          <span style={{ color: "red" }}>
            <b>{githubVulAlerts.length}</b>
          </span>
        )}
      </td>
      <td>
        {data.lastDatapoint.snyk == null ? (
          <>Mangler Snyk</>
        ) : data.lastDatapoint.snyk.totalIssues === 0 ? (
          <span style={{ color: "green" }}>Ingen</span>
        ) : (
          <span style={{ color: "red" }}>
            <b>{data.lastDatapoint.snyk.totalIssues}</b>
          </span>
        )}
      </td>
    </tr>
  )
}

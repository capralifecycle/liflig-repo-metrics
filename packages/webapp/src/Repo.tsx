import { WebappMetricDataRepo } from "@liflig/repo-metrics-repo-collector-types"
import * as React from "react"

interface Props {
  data: WebappMetricDataRepo
  showPrList: boolean
  showDepList: boolean
  showVulList: boolean
}

type SnykType = "high" | "medium" | "low"

function snykStyle(type: SnykType): React.CSSProperties {
  switch (type) {
    case "low":
      return {
        color: "orange",
      }
    case "medium":
      return {
        color: "red",
      }
    case "high":
      return {
        color: "red",
        fontWeight: "bold",
      }
  }
}

const SnykItem: React.FC<{
  value: number
  type: SnykType
}> = ({ value, type }) => (
  <span title={type}>
    {value === 0 ? (
      <span style={{ color: "#AAA" }}>{value}</span>
    ) : (
      <span style={snykStyle(type)}>{value}</span>
    )}
  </span>
)

export const Repo: React.FC<Props> = ({
  data,
  showPrList,
  showDepList,
  showVulList,
}) => {
  const availableUpdates = data.lastDatapoint.github.availableUpdates
  const githubVulAlerts = data.lastDatapoint.github.vulnerabilityAlerts
  const snyk = data.lastDatapoint.snyk
  const prs = data.lastDatapoint.github.prs

  const repoBaseUrl = `https://github.com/${data.github.orgName}/${data.github.repoName}`

  return (
    <tr>
      <td>
        <a href={repoBaseUrl}>{data.repoId}</a>
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
        {prs.length === 0 ? (
          <span style={{ color: "green" }}>Ingen</span>
        ) : (
          <>
            <b>{prs.length}</b>
            {showPrList && (
              <ul>
                {prs.map((pr, idx) => (
                  <li key={idx}>
                    <a href={`${repoBaseUrl}/pulls/${pr.number}`}>
                      #{pr.number}
                    </a>{" "}
                    {pr.title} ({pr.author})
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
          <>
            <span style={{ color: "red" }}>
              <b>{githubVulAlerts.length}</b>
            </span>
            {showVulList && (
              <ul>
                {githubVulAlerts.map((vul, idx) => (
                  <li key={idx}>
                    {vul.packageName} ({vul.severity})
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </td>
      <td>
        {snyk == null ? (
          <>Mangler Snyk</>
        ) : snyk.totalIssues === 0 ? (
          <span style={{ color: "green" }}>Ingen</span>
        ) : (
          <>
            <SnykItem value={snyk.countsBySeverity.high} type="high" />
            <span style={{ color: "#AAA" }}> / </span>
            <SnykItem value={snyk.countsBySeverity.medium} type="medium" />
            <span style={{ color: "#AAA" }}> / </span>
            <SnykItem value={snyk.countsBySeverity.low} type="low" />
          </>
        )}
      </td>
    </tr>
  )
}

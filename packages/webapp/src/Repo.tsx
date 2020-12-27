import {
  WebappMetricDataRepo,
  WebappMetricDataRepoDatapoint,
} from "@liflig/repo-metrics-repo-collector-types"
import * as React from "react"
import { PrColumnDetails } from "./PrColumnDetails"

function isBotPr(pr: WebappMetricDataRepoDatapoint["github"]["prs"][0]) {
  return (
    ["dependabot", "renovate"].includes(pr.author) ||
    pr.title.startsWith("[Snyk]")
  )
}

export function isActionableRepo(repo: WebappMetricDataRepoDatapoint): boolean {
  return (
    (repo.github.availableUpdates ?? []).filter((it) => it.isActionable)
      .length > 0 ||
    repo.github.prs.filter((it) => isBotPr(it)).length > 0 ||
    isVulnerableRepo(repo)
  )
}

export function isVulnerableRepo(repo: WebappMetricDataRepoDatapoint): boolean {
  return (
    repo.github.vulnerabilityAlerts.length > 0 ||
    (repo.snyk?.totalIssues ?? 0) > 0
  )
}

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
  const renovateEnabled = data.lastDatapoint.github.availableUpdates != null
  const availableUpdates = (
    data.lastDatapoint.github.availableUpdates ?? []
  ).flatMap((category) =>
    category.updates.map((it) => ({
      name: it.name,
      isActionable: category.isActionable,
      categoryName: category.categoryName,
      toVersion: it.toVersion,
    })),
  )
  const actionableUpdates = availableUpdates.filter((it) => it.isActionable)
    .length

  const renovateDashboad = data.lastDatapoint.github.renovateDependencyDashboard

  const githubVulAlerts = data.lastDatapoint.github.vulnerabilityAlerts
  const snyk = data.lastDatapoint.snyk

  const repoBaseUrl = `https://github.com/${data.github.orgName}/${data.github.repoName}`

  function issueUrl(issueNumber: number) {
    return `${repoBaseUrl}/issues/${issueNumber}`
  }

  const MaybeRenovateLink: React.FC = ({ children }) =>
    renovateDashboad != null ? (
      <a href={issueUrl(renovateDashboad.issueNumber)}>{children}</a>
    ) : (
      <>{children}</>
    )

  return (
    <tr>
      <td>
        <a href={repoBaseUrl}>{data.repoId}</a>
      </td>
      <td>
        {renovateDashboad?.daysSinceLastUpdate != null &&
          renovateDashboad.daysSinceLastUpdate >= 20 && (
            <div className="renovate-old">
              <MaybeRenovateLink>
                Sist oppdatert {renovateDashboad.daysSinceLastUpdate} dager
                siden
              </MaybeRenovateLink>
            </div>
          )}
        {!renovateEnabled ? (
          <span className="renovate-missing">Mangler Renovate</span>
        ) : actionableUpdates === 0 ? (
          <span className="renovate-ok">
            <MaybeRenovateLink>Alt oppdatert</MaybeRenovateLink>
          </span>
        ) : (
          <>
            <MaybeRenovateLink>
              <b>{actionableUpdates}</b>
            </MaybeRenovateLink>
            {showDepList && (
              <ul>
                {availableUpdates.map((available) => (
                  <li
                    key={available.name}
                    style={available.isActionable ? {} : { color: "#AAA" }}
                  >
                    {available.name} ({available.toVersion}) (
                    {available.categoryName})
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </td>
      <td>
        <PrColumnDetails
          prs={data.lastDatapoint.github.prs.filter((it) => isBotPr(it))}
          repoBaseUrl={repoBaseUrl}
          showPrList={showPrList}
        />
      </td>
      <td>
        <PrColumnDetails
          prs={data.lastDatapoint.github.prs.filter((it) => !isBotPr(it))}
          repoBaseUrl={repoBaseUrl}
          showPrList={showPrList}
        />
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

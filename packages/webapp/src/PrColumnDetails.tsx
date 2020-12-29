import { WebappMetricDataRepoDatapoint } from "@liflig/repo-metrics-repo-collector-types"
import * as React from "react"

interface Props {
  prs: WebappMetricDataRepoDatapoint["github"]["prs"]
  repoBaseUrl: string
  showPrList: boolean
}

export const PrColumnDetails: React.FC<Props> = ({
  prs,
  repoBaseUrl,
  showPrList,
}) => {
  if (prs.length === 0) {
    return <span style={{ color: "green" }}>Ingen</span>
  }

  return (
    <>
      <b>{prs.length}</b>
      {showPrList && (
        <ul>
          {prs.map((pr, idx) => (
            <li key={idx}>
              <a href={`${repoBaseUrl}/pull/${pr.number}`}>#{pr.number}</a>{" "}
              {pr.title} ({pr.author})
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

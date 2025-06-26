import type { Metrics } from "@liflig/repo-metrics-repo-collector-types"
import { formatDistance } from "date-fns"
import type * as React from "react"

interface Props {
  prs: Metrics["github"]["prs"]
  repoBaseUrl: string
  showPrList: boolean
}

export const PrColumnDetails: React.FC<Props> = ({
  prs,
  repoBaseUrl,
  showPrList,
}) => {
  if (prs.length === 0) {
    return <span style={{ color: "var(--color-success)" }}>Ingen</span>
  }

  const now = new Date()

  return (
    <>
      <b>{prs.length}</b>
      {showPrList && (
        <ul>
          {prs.map((pr, idx) => (
            <li key={idx}>
              <a href={`${repoBaseUrl}/pull/${pr.number}`}>#{pr.number}</a>{" "}
              {pr.title} ({pr.author},{" "}
              {formatDistance(pr.createdAt, now, {
                addSuffix: true,
              })}
              )
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

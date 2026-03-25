import type { Metrics } from "@liflig/repo-metrics-repo-collector-types"
import { formatDistance } from "date-fns"
import type * as React from "react"
import { Highlight } from "./Highlight"

interface Props {
  prs: Metrics["github"]["prs"]
  repoBaseUrl: string
  showPrList: boolean
  filterUpdateName: string
}

export const PrColumnDetails: React.FC<Props> = ({
  prs,
  repoBaseUrl,
  showPrList,
  filterUpdateName,
}) => {
  if (prs.length === 0) {
    return <a href={`${repoBaseUrl}/pulls`} className="state-ok">Ingen</a>
  }

  const now = new Date()

  const hasSearch = filterUpdateName !== ""
  const matchingPrs = hasSearch
    ? prs.filter((pr) =>
        pr.title.toLowerCase().includes(filterUpdateName.toLowerCase()),
      )
    : []

  const showAll = showPrList
  const showMatches = !showAll && matchingPrs.length > 0
  const prsToShow = showAll ? prs : showMatches ? matchingPrs : []

  if (prsToShow.length > 0) {
    return (
      <ul className="detail-list">
        {prsToShow.map((pr, idx) => (
          <li key={idx} className="detail-item">
            <span className="detail-index">{idx + 1}</span>
            <a href={`${repoBaseUrl}/pull/${pr.number}`}>#{pr.number}</a>{" "}
            <Highlight text={pr.title} search={filterUpdateName} />
            <span className="detail-meta">
              {" "}· {pr.author} · {formatDistance(pr.createdAt, now, { addSuffix: true })}
            </span>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <a href={`${repoBaseUrl}/pulls`}><b>{prs.length}</b></a>
  )
}

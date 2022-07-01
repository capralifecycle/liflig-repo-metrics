import * as React from "react"
import { useEffect, useState } from "react"
import { update } from "lodash"

interface Props {
  mostRecentDataTimestamp: string
  updateCallback: () => void
}

// How old must the data be before we allow fetching an updated version?
const MAXIMUM_UPDATE_FREQUENCY_THRESHOLD_MINUTES = 30

// Should
// 1. Make sure the repo data is as recent as possible
// ("possible" according to some metric, max every 30 minutes as an initial heuristic)
// 2. If old data is older than threshold, use aws lambda to fetch a new one into webapp.json
// 3. Reload data from file
export const ReloadButton: React.FC<Props> = ({
  mostRecentDataTimestamp,
  updateCallback,
}) => {
  const [clicks, setClicks] = useState(0)

  const clickHandler: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    setClicks(clicks + 1)

    // Only update the date if the last update was more than oldDataMinuteThreshold minutes ago
    if (shouldUpdateData(mostRecentDataTimestamp)) {
      updateCallback()
    }
  }
  useEffect(() => {
    console.log("der skjedd det en rerender gitt")
  })

  const buttonText = `Oppdater data for ${clicks}. gang. Sist oppdatert ${mostRecentDataTimestamp}`

  return <button onClick={clickHandler}>{buttonText}</button>
}

const shouldUpdateData = (mostRecentDataTimestamp: string) => {
  const mostRecentTimestampDate = new Date(mostRecentDataTimestamp)
  const curTimestampDate = new Date()
  const oldDataMinuteThreshold = MAXIMUM_UPDATE_FREQUENCY_THRESHOLD_MINUTES

  return dateDifferenceisGreaterThanMinutes(
    mostRecentTimestampDate,
    curTimestampDate,
    oldDataMinuteThreshold,
  )
}

const dateDifferenceisGreaterThanMinutes = (
  date1: Date,
  date2: Date,
  minutes: number,
) => {
  console.log(date1, date2)

  const minutesAsMilliseconds = minutes * 60 * 1000
  const date1Milliseconds = date1.getTime()
  const date2Milliseconds = date2.getTime()

  const absoluteDifferenceMilliseconds = Math.abs(
    date1Milliseconds - date2Milliseconds,
  )

  console.log(
    "MIllisecond difference is",
    absoluteDifferenceMilliseconds,
    " the threshold is ",
    minutesAsMilliseconds,
  )

  return absoluteDifferenceMilliseconds > minutesAsMilliseconds
}

import DateHolidays from "date-holidays"
import type { Temporal } from "@js-temporal/polyfill"

let holidays: DateHolidays | null = null

function isHoliday(date: Temporal.PlainDate) {
  if (holidays == null) {
    holidays = new DateHolidays("NO")
  }

  return holidays.isHoliday(
    new Date(Date.parse(date.toPlainDateTime().toString())),
  )
}

function isWeekend(date: Temporal.PlainDate) {
  return date.dayOfWeek >= 6
}

export function isWorkingDay(date: Temporal.PlainDate) {
  return !isHoliday(date) && !isWeekend(date)
}

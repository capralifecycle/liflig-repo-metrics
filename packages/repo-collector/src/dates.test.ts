import { Temporal } from "@js-temporal/polyfill"
import { expect, test } from "vitest"
import { isWorkingDay } from "./dates"

const workingDays: [date: string, description: string][] = [
  ["2026-09-14", "Monday"],
  ["2026-01-02", "Friday"],
]

const nonWorkingDays: [date: string, description: string][] = [
  ["2026-01-03", "Saturday"],
  ["2026-01-04", "Sunday"],
  ["2026-01-01", "New Year's Day, a Thursday"],
  ["2026-04-02", "Maundy Thursday"],
  ["2026-04-03", "Good Friday"],
  ["2026-04-06", "Easter Monday"],
  ["2026-05-01", "Labour Day, a Friday"],
  ["2027-05-17", "Constitution Day, a Monday"],
  ["2026-12-25", "Christmas Day, a Friday"],
]

test.each(workingDays)("%s (%s) is a working day", (date) => {
  expect(isWorkingDay(Temporal.PlainDate.from(date))).toBe(true)
})

test.each(nonWorkingDays)("%s (%s) is not a working day", (date) => {
  expect(isWorkingDay(Temporal.PlainDate.from(date))).toBe(false)
})

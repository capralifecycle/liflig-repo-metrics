import { Temporal } from "@js-temporal/polyfill"
import { calculateCutoffTimestamp } from "./reporter"

test("cutoff on wednesday in normal week", () => {
  const wednesday = Temporal.Instant.from("2021-03-03T04:30:22.123Z")
  const cutoff = calculateCutoffTimestamp(wednesday)

  expect(cutoff).toStrictEqual(Temporal.Instant.from("2021-03-02T06:30:00Z"))
})

test("cutoff on monday with normal friday before", () => {
  const wednesday = Temporal.Instant.from("2021-03-01T04:30:22.123Z")
  const cutoff = calculateCutoffTimestamp(wednesday)

  expect(cutoff).toStrictEqual(Temporal.Instant.from("2021-02-26T06:30:00Z"))
})

test("cutoff on monday with friday before being holiday", () => {
  const wednesday = Temporal.Instant.from("2021-01-04T04:30:22.123Z")
  const cutoff = calculateCutoffTimestamp(wednesday)

  expect(cutoff).toStrictEqual(Temporal.Instant.from("2020-12-31T06:30:00Z"))
})

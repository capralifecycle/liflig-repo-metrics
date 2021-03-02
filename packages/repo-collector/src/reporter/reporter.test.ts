import { calculateCutoffTimestamp } from "./reporter"

test("cutoff on wednesday in normal week", () => {
  const wednesday = new Date("2021-03-03 04:30:22.123 UTC")
  const cutoff = calculateCutoffTimestamp(wednesday)

  expect(cutoff).toStrictEqual(new Date("2021-03-02 06:30:00 UTC"))
})

test("cutoff on monday with normal friday before", () => {
  const wednesday = new Date("2021-03-01 04:30:22.123 UTC")
  const cutoff = calculateCutoffTimestamp(wednesday)

  expect(cutoff).toStrictEqual(new Date("2021-02-26 06:30:00 UTC"))
})

test("cutoff on monday with friday before being holiday", () => {
  const wednesday = new Date("2021-01-04 04:30:22.123 UTC")
  const cutoff = calculateCutoffTimestamp(wednesday)

  expect(cutoff).toStrictEqual(new Date("2020-12-31 06:30:00 UTC"))
})

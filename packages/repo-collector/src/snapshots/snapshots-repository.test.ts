import { Temporal } from "proposal-temporal"
import { forTests } from "./snapshots-repository"

test("formatTimestampForFilename", () => {
  const i1 = Temporal.Instant.from("2021-03-04T17:33:21.2202Z")
  const f1 = forTests.formatTimestampForFilename(i1)

  expect(f1).toStrictEqual("20210304T173321.220Z")

  const i2 = Temporal.Instant.from("2021-03-04T17:33:21.22Z")
  const f2 = forTests.formatTimestampForFilename(i2)

  expect(f2).toStrictEqual("20210304T173321.220Z")

  const i3 = Temporal.Instant.from("2021-03-04T17:33:21Z")
  const f3 = forTests.formatTimestampForFilename(i3)

  expect(f3).toStrictEqual("20210304T173321.000Z")
})

test("parsePathToTimestamp", () => {
  const i1 = "path/20210304T173321.220Z.json"
  const f1 = forTests.parsePathToTimestamp(i1)

  expect(f1).toStrictEqual(Temporal.Instant.from("2021-03-04T17:33:21.220Z"))

  const i2 = "path/20210304T173321.000Z"
  const f2 = forTests.parsePathToTimestamp(i2)

  expect(f2).toStrictEqual(Temporal.Instant.from("2021-03-04T17:33:21Z"))
})

import { Environment, getEnvironment, getConfig } from "./config-utils"

describe("getEnvironment", () => {
  test.each`
    value                               | expectedResult
    ${"http://localhost:3000"}          | ${Environment.LOCAL}
    ${"http://localhost:8000"}          | ${Environment.LOCAL}
    ${"https://dev.example.com"}        | ${Environment.DEV}
    ${"https://www.dev.example.com"}    | ${Environment.DEV}
    ${"https://staging.example.com"}    | ${Environment.STAGING}
    ${"https://www.staging.example.no"} | ${Environment.STAGING}
    ${"https://example.com"}            | ${Environment.PROD}
    ${"https://www.example.com"}        | ${Environment.PROD}
  `("should return $expectedResult for $value", ({ expectedResult, value }) => {
    /* eslint-disable-next-line @typescript-eslint/no-unsafe-argument */
    expect(getEnvironment(value)).toEqual(expectedResult)
  })
})

describe("getConfig", () => {
  test("should fetch config for local environment", () => {
    const config = getConfig("http://localhost:3000")

    expect(config.environment).toBe(Environment.LOCAL)
  })

  test("should fetch config for staging environment", () => {
    const config = getConfig("https://staging.example.com")

    expect(config.environment).toBe(Environment.STAGING)
  })

  test("should fetch config for prod environment", () => {
    const config = getConfig("https://example.com")

    expect(config.environment).toBe(Environment.PROD)
  })
})

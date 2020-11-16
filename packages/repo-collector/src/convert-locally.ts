import { MetricRepoSnapshot } from "@liflig/repo-metrics-repo-collector-types"
import * as fs from "fs"
import { createWebappFriendlyFormat } from "./webapp"

// eslint-disable-next-line @typescript-eslint/require-await
async function main() {
  const dataFile = "../repo-collector/data/snapshots.json"
  const webappFile = "data/webapp.json"

  if (!fs.existsSync(dataFile)) {
    throw new Error(`File ${dataFile} not found`)
  }

  const data = JSON.parse(
    fs.readFileSync(dataFile, "utf-8"),
  ) as MetricRepoSnapshot[]

  const webappFriendly = createWebappFriendlyFormat(data)
  fs.writeFileSync(
    webappFile,
    JSON.stringify(webappFriendly, undefined, "  "),
    "utf-8",
  )
}

main().catch((error) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  console.error(error.stack || error.message || error)
  process.exitCode = 1
})

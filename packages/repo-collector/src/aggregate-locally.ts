import { LocalSnapshotsRepository } from "./snapshots/snapshots-repository"
import {
  createWebappFriendlyFormat,
  retrieveSnapshotsForWebappAggregation,
} from "./webapp/webapp"
import { LocalWebappDataRepository } from "./webapp/webapp-data-repository"

async function main() {
  const snapshotsRepository = new LocalSnapshotsRepository()
  const webdataRepository = new LocalWebappDataRepository()

  const snapshots =
    await retrieveSnapshotsForWebappAggregation(snapshotsRepository)
  const webappFriendly = createWebappFriendlyFormat(snapshots)
  await webdataRepository.store(webappFriendly)
}

main().catch((error) => {
  console.error(error.stack || error.message || error)
  process.exitCode = 1
})

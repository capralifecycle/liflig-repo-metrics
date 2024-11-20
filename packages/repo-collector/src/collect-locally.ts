import { collect } from "./snapshots/collect"
import { LocalSnapshotsRepository } from "./snapshots/snapshots-repository"

async function main() {
  const snapshotsRepository = new LocalSnapshotsRepository()
  await collect(snapshotsRepository)
}

main().catch((error) => {
  console.error(error.stack || error.message || error)
  process.exitCode = 1
})

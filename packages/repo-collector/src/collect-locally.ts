import { collect } from "./snapshots/collect"
import { LocalSnapshotsRepository } from "./snapshots/snapshots-repository"

async function main() {
  const snapshotsRepository = new LocalSnapshotsRepository()
  await collect(snapshotsRepository)
}

main().catch((error) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  console.error(error.stack || error.message || error)
  process.exitCode = 1
})

import { paginateListObjectsV2, S3 } from "@aws-sdk/client-s3"
import { MetricRepoSnapshot } from "@liflig/repo-metrics-repo-collector-types"
import * as fs from "fs"
import * as getStream from "get-stream"
import * as path from "path"
import { Temporal } from "@js-temporal/polyfill"
import { Readable } from "stream"

export interface SnapshotsRepository {
  store(timestamp: Temporal.Instant, data: MetricRepoSnapshot[]): Promise<void>
  retrieveAll(): Promise<MetricRepoSnapshot[]>
  retrieve(timestamp: Temporal.Instant): Promise<MetricRepoSnapshot[]>
  list(): Promise<SnapshotObject[]>
}

interface SnapshotObject {
  timestamp: Temporal.Instant
}

function toNdJson<T>(data: T[]): string {
  let result = ""
  for (const item of data) {
    result += JSON.stringify(item) + "\n"
  }
  return result
}

function fromNdJson<T>(data: string): T[] {
  const result: T[] = []
  const lines = data.split("\n")
  for (const line of lines) {
    if (line == "") continue
    result.push(JSON.parse(line) as T)
  }
  return result
}

function formatTimestampForFilename(instant: Temporal.Instant): string {
  // Format as YYYYMMDDTHHmmss.SSSZ
  const z = instant.toZonedDateTimeISO("UTC")
  const day = z.toPlainDate().toString().replace(/-/g, "")
  const time = z
    .toPlainTime()
    .round({ smallestUnit: "seconds", roundingMode: "trunc" })
    .toString()
    .replace(/:/g, "")
  const ms = z.millisecond.toString().padStart(3, "0")
  return `${day}T${time}.${ms}Z`
}

function parsePathToTimestamp(p: string): Temporal.Instant | undefined {
  // Parse YYYYMMDDTHHmmss.SSSZ
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d{3})Z$/.exec(
    p.replace(/.*\//, "").replace(/\.json$/, ""),
  )

  if (!match) return undefined

  return Temporal.ZonedDateTime.from({
    timeZone: "UTC",
    year: parseInt(match[1]),
    month: parseInt(match[2]),
    day: parseInt(match[3]),
    hour: parseInt(match[4]),
    minute: parseInt(match[5]),
    second: parseInt(match[6]),
    millisecond: parseInt(match[7]),
  }).toInstant()
}

/**
 * Snapshots repository using local storage to be used with
 * local development and testing.
 */
export class LocalSnapshotsRepository implements SnapshotsRepository {
  private base = "data/snapshots"

  private pathForTimestamp(timestamp: Temporal.Instant): string {
    return `${this.base}/${formatTimestampForFilename(timestamp)}.json`
  }

  async store(
    timestamp: Temporal.Instant,
    data: MetricRepoSnapshot[],
  ): Promise<void> {
    await fs.promises.writeFile(
      this.pathForTimestamp(timestamp),
      toNdJson(data),
    )
  }

  async retrieveAll(): Promise<MetricRepoSnapshot[]> {
    const result: MetricRepoSnapshot[] = []

    for (const object of await this.list()) {
      const items = await this.retrieve(object.timestamp)
      result.push(...items)
    }

    return result
  }

  async retrieve(timestamp: Temporal.Instant): Promise<MetricRepoSnapshot[]> {
    const p = this.pathForTimestamp(timestamp)

    const stat = await fs.promises.stat(p)

    if (!stat.isFile) throw new Error(`Not a file: ${p}`)

    return fromNdJson<MetricRepoSnapshot>(
      await fs.promises.readFile(p, "utf-8"),
    )
  }

  async list(): Promise<SnapshotObject[]> {
    const items = await fs.promises.readdir(this.base)
    const result: SnapshotObject[] = []

    for (const item of items) {
      if (!item.endsWith(".json")) continue

      const p = path.join(this.base, item)

      const stat = await fs.promises.stat(p)
      if (!stat.isFile) continue

      const timestamp = parsePathToTimestamp(item)
      if (timestamp === undefined) continue

      result.push({ timestamp })
    }

    return result
  }
}

/**
 * Snapshots repository using S3 as storage.
 */
export class S3SnapshotsRepository implements SnapshotsRepository {
  private s3Client: S3
  private bucketName: string

  constructor(bucketName: string) {
    this.s3Client = new S3({})

    // Workaround for https://github.com/aws/aws-sdk-js-v3/issues/1800
    // Source: https://github.com/aws/aws-sdk-js-v3/issues/1800#issuecomment-749459712
    this.s3Client.middlewareStack.add(
      (next) => async (args) => {
        args.request
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any
        delete (args.request as any).headers["content-type"]
        return next(args)
      },
      { step: "build" },
    )

    this.bucketName = bucketName
  }

  private keyForTimestamp(timestamp: Temporal.Instant): string {
    return `snapshots/${formatTimestampForFilename(timestamp)}.json`
  }

  /**
   * Store snapshots of data to S3 by putting them in a newline delimited
   * JSON file specific for this batch.
   */
  async store(
    timestamp: Temporal.Instant,
    data: MetricRepoSnapshot[],
  ): Promise<void> {
    await this.s3Client.putObject({
      Bucket: this.bucketName,
      Key: this.keyForTimestamp(timestamp),
      Body: toNdJson(data),
      ContentType: "application/json",
    })
  }

  /**
   * Retrieve all snapshots from S3.
   *
   * TODO: This will not scale indefinitely due to memory, so we need to
   *   improve this later e.g. by filtering out what we want to read.
   */
  async retrieveAll(): Promise<MetricRepoSnapshot[]> {
    const result: MetricRepoSnapshot[] = []

    for (const object of await this.list()) {
      const items = await this.retrieve(object.timestamp)
      result.push(...items)
    }

    return result
  }

  async retrieve(timestamp: Temporal.Instant): Promise<MetricRepoSnapshot[]> {
    const key = this.keyForTimestamp(timestamp)

    console.log(`Reading ${key}`)
    const item = await this.s3Client.getObject({
      Bucket: this.bucketName,
      Key: key,
    })

    const data = await getStream(item.Body as Readable)
    const items = fromNdJson<MetricRepoSnapshot>(data)

    console.log(`Found ${items.length} items in ${key}`)

    return items
  }

  async list(): Promise<SnapshotObject[]> {
    const paginator = paginateListObjectsV2(
      {
        client: this.s3Client,
      },
      {
        Bucket: this.bucketName,
        Prefix: "snapshots/",
      },
    )

    const objects: SnapshotObject[] = []

    for await (const page of paginator) {
      for (const item of page.Contents || []) {
        if (item.Key == null) {
          throw new Error("Missing Key")
        }

        const timestamp = parsePathToTimestamp(item.Key)
        if (timestamp != null) {
          objects.push({ timestamp })
        }
      }
    }

    console.log(`Found ${objects.length} files`)

    return objects
  }
}

export const forTests = {
  formatTimestampForFilename,
  parsePathToTimestamp,
}

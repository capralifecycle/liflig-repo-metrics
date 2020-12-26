import { paginateListObjectsV2, S3 } from "@aws-sdk/client-s3"
import { MetricRepoSnapshot } from "@liflig/repo-metrics-repo-collector-types"
import * as fs from "fs"
import * as getStream from "get-stream"
import * as path from "path"
import { Readable } from "stream"

export interface SnapshotsRepository {
  store(timestamp: Date, data: MetricRepoSnapshot[]): Promise<void>
  retrieveAll(): Promise<MetricRepoSnapshot[]>
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

function formatTimestampForFilename(date: Date): string {
  // Format as YYYYMMDDTHHmmss.SSSZ
  return date.toISOString().replace(/-/g, "").replace(/:/g, "")
}

/**
 * Snapshots repository using local storage to be used with
 * local development and testing.
 */
export class LocalSnapshotsRepository implements SnapshotsRepository {
  async store(timestamp: Date, data: MetricRepoSnapshot[]): Promise<void> {
    const file = `data/snapshots/${formatTimestampForFilename(timestamp)}.json`

    await fs.promises.writeFile(file, toNdJson(data))
  }

  async retrieveAll(): Promise<MetricRepoSnapshot[]> {
    const result: MetricRepoSnapshot[] = []

    const base = "data/snapshots"
    const items = await fs.promises.readdir(base)

    for (const item of items) {
      if (!item.endsWith(".json")) continue

      const p = path.join(base, item)
      const stat = await fs.promises.stat(p)

      if (!stat.isFile) continue

      const data = fromNdJson<MetricRepoSnapshot>(
        await fs.promises.readFile(p, "utf-8"),
      )
      result.push(...data)
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

  /**
   * Store snapshots of data to S3 by putting them in a newline delimited
   * JSON file specific for this batch.
   */
  async store(timestamp: Date, data: MetricRepoSnapshot[]): Promise<void> {
    await this.s3Client.putObject({
      Bucket: this.bucketName,
      Key: `snapshots/${formatTimestampForFilename(timestamp)}.json`,
      Body: toNdJson(data),
      ContentType: "application/json",
    })
  }

  /**
   * Retrieve all snapshots from S3.
   *
   * TODO: This will not scale indefinitely due to memory, so we need to
   *   improve this later e.g. by filtering out what we want ot read.
   */
  async retrieveAll(): Promise<MetricRepoSnapshot[]> {
    const paginator = paginateListObjectsV2(
      {
        client: this.s3Client,
      },
      {
        Bucket: this.bucketName,
        Prefix: "snapshots/",
      },
    )

    const files: string[] = []

    for await (const page of paginator) {
      for (const item of page.Contents || []) {
        if (item.Key == null) {
          throw new Error("Missing Key")
        }

        if (item.Key.endsWith(".json")) {
          files.push(item.Key)
        }
      }
    }

    console.log(`Found ${files.length} files`)

    const result: MetricRepoSnapshot[] = []

    for (const key of files) {
      console.log(`Reading ${key}`)
      const item = await this.s3Client.getObject({
        Bucket: this.bucketName,
        Key: key,
      })

      const data = await getStream(item.Body as Readable)
      const items = fromNdJson<MetricRepoSnapshot>(data)

      for (const item of items) {
        result.push(item)
      }

      console.log(`Found ${items.length} items in ${key}`)
    }

    return result
  }
}

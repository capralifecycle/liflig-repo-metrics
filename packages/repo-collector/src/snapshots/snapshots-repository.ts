import { promises as fs } from "node:fs"
import type { Readable } from "node:stream"
import { S3 } from "@aws-sdk/client-s3"
import type { SnapshotData } from "@liflig/repo-metrics-repo-collector-types"
import getStream from "get-stream"

export interface SnapshotsRepository {
  store(data: SnapshotData): Promise<void>
  get(): Promise<SnapshotData>
}

/**
 * Snapshots repository using local storage to be used with
 * local development and testing.
 */
export class LocalSnapshotsRepository implements SnapshotsRepository {
  private readonly snapshotDataPath = "data/snapshot.json"

  async store(snapshotData: SnapshotData): Promise<void> {
    await fs.writeFile(
      this.snapshotDataPath,
      JSON.stringify(snapshotData, undefined, "  "),
      "utf-8",
    )
  }

  /**
   * Read SnapshotData from a local file
   */
  async get(): Promise<SnapshotData> {
    const stat = await fs.stat(this.snapshotDataPath)
    if (!stat.isFile()) {
      throw new Error(`Not a file: ${this.snapshotDataPath}`)
    }

    const data: string = await fs.readFile(this.snapshotDataPath, "utf-8")
    return JSON.parse(data) as SnapshotData
  }
}

/**
 * Snapshot repository using S3 as storage.
 */
export class S3SnapshotsRepository implements SnapshotsRepository {
  private readonly s3Client: S3
  private readonly bucketName: string
  private readonly snapshotDataS3Key = "snapshot.json"

  constructor(bucketName: string) {
    this.s3Client = new S3({})
    this.bucketName = bucketName
  }

  /**
   * Store snapshots of data to S3 by putting them in a newline-delimited
   * JSON file specific for this batch.
   */
  async store(snapshotData: SnapshotData): Promise<void> {
    await this.s3Client.putObject({
      Bucket: this.bucketName,
      Key: this.snapshotDataS3Key,
      Body: JSON.stringify(snapshotData, undefined, "  "),
      ContentType: "application/json",
    })
  }

  async get(): Promise<SnapshotData> {
    const item = await this.s3Client.getObject({
      Bucket: this.bucketName,
      Key: this.snapshotDataS3Key,
    })
    const data: string = await getStream(item.Body as Readable)
    return JSON.parse(data) as SnapshotData
  }
}

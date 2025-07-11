import * as fs from "node:fs"
import { CloudFront } from "@aws-sdk/client-cloudfront"
import { S3 } from "@aws-sdk/client-s3"
import { Temporal } from "@js-temporal/polyfill"
import type { WebappData } from "@liflig/repo-metrics-repo-collector-types"

export interface WebappDataRepository {
  store(data: WebappData): Promise<void>
}

export class LocalWebappDataRepository implements WebappDataRepository {
  async store(data: WebappData): Promise<void> {
    const webappFile = "data/webapp.json"

    await fs.promises.writeFile(
      webappFile,
      JSON.stringify(data, undefined, "  "),
      "utf-8",
    )
  }
}

export class S3WebappDataRepository implements WebappDataRepository {
  private s3Client: S3
  private cloudfrontClient: CloudFront
  private readonly bucketName: string
  private readonly cfDistributionId: string

  constructor(bucketName: string, cfDistributionId: string) {
    this.s3Client = new S3({})

    // Workaround for https://github.com/aws/aws-sdk-js-v3/issues/1800
    // Source: https://github.com/aws/aws-sdk-js-v3/issues/1800#issuecomment-749459712
    this.s3Client.middlewareStack.add(
      (next) => async (args) => {
        delete (args.request as any).headers["content-type"]
        return next(args)
      },
      { step: "build" },
    )

    this.cloudfrontClient = new CloudFront({})

    this.bucketName = bucketName
    this.cfDistributionId = cfDistributionId
  }

  async store(data: WebappData): Promise<void> {
    await this.s3Client.putObject({
      Bucket: this.bucketName,
      Key: "data/webapp.json",
      Body: JSON.stringify(data, undefined, "  "),
      ContentType: "application/json",
    })

    await this.cloudfrontClient.createInvalidation({
      DistributionId: this.cfDistributionId,
      InvalidationBatch: {
        CallerReference: Temporal.Now.instant().toString(),
        Paths: {
          Quantity: 1,
          Items: ["/data/*"],
        },
      },
    })
  }
}

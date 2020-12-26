import { CloudFront } from "@aws-sdk/client-cloudfront"
import { S3 } from "@aws-sdk/client-s3"
import { WebappMetricData } from "@liflig/repo-metrics-repo-collector-types"
import * as fs from "fs"

export interface WebappDataRepository {
  store(data: WebappMetricData): Promise<void>
}

export class LocalWebappDataRepository implements WebappDataRepository {
  async store(data: WebappMetricData): Promise<void> {
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
  private bucketName: string
  private cfDistributionId: string

  constructor(bucketName: string, cfDistributionId: string) {
    this.s3Client = new S3({})

    // Workaround for https://github.com/aws/aws-sdk-js-v3/issues/1800
    // Source: https://github.com/aws/aws-sdk-js-v3/issues/1800#issuecomment-749459712
    this.s3Client.middlewareStack.add(
      (next) => async (args) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any
        delete (args.request as any).headers["content-type"]
        return next(args)
      },
      { step: "build" },
    )

    this.cloudfrontClient = new CloudFront({})

    this.bucketName = bucketName
    this.cfDistributionId = cfDistributionId
  }

  async store(data: WebappMetricData): Promise<void> {
    await this.s3Client.putObject({
      Bucket: this.bucketName,
      Key: `data/webapp.json`,
      Body: JSON.stringify(data, undefined, "  "),
      ContentType: "application/json",
    })

    await this.cloudfrontClient.createInvalidation({
      DistributionId: this.cfDistributionId,
      InvalidationBatch: {
        CallerReference: new Date().toISOString(),
        Paths: {
          Quantity: 1,
          Items: ["/data/*"],
        },
      },
    })
  }
}

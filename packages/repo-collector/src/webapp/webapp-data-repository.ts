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
    this.cloudfrontClient = new CloudFront({})

    this.bucketName = bucketName
    this.cfDistributionId = cfDistributionId
  }

  async store(data: WebappMetricData): Promise<void> {
    await this.s3Client.putObject({
      Bucket: this.bucketName,
      Key: `data/webapp.json`,
      Body: JSON.stringify(data, undefined, "  "),
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

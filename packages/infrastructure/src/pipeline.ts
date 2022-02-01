import * as constructs from "constructs"
import * as s3 from "aws-cdk-lib/aws-s3"
import * as sm from "aws-cdk-lib/aws-secretsmanager"
import * as cdk from "aws-cdk-lib"
import { cdkPipelines } from "@liflig/cdk"
import { incubatorAccountId } from "./config"
import { RepoMetricsEnv } from "./environment"

export class PipelineStack extends cdk.Stack {
  constructor(scope: constructs.Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props)

    // No Griid for incub yet.
    const artifactsBucket = s3.Bucket.fromBucketName(
      this,
      "ArtifactsBucket",
      "incub-common-build-artifacts-001112238813-eu-west-1",
    )

    const pipeline = new cdkPipelines.LifligCdkPipeline(this, "Pipeline", {
      artifactsBucket,
      pipelineName: "incub-repo-metrics",
      sourceType: "cloud-assembly",
    })

    pipeline.addSlackNotification({
      slackWebhookUrl: sm.Secret.fromSecretNameV2(
        this,
        "WebhookUrl",
        "/incub/repo-metrics/cicd-slack-webhook-url",
      )
        .secretValueFromJson("url")
        .toString(),
      slackChannel: "#cals-dev-info",
    })

    pipeline.cdkPipeline.addStage(
      new RepoMetricsEnv(this, "Incubator", {
        env: {
          account: incubatorAccountId,
          region: "eu-west-1",
        },
      }),
    )
  }
}

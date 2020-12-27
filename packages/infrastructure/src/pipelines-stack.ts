import * as ec2 from "@aws-cdk/aws-ec2"
import * as s3 from "@aws-cdk/aws-s3"
import * as cdk from "@aws-cdk/core"
import { pipelines } from "@liflig/cdk"

interface Props extends cdk.StackProps {
  vpcId: string
}

export class PipelinesStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: Props) {
    super(scope, id, props)

    const vpc = ec2.Vpc.fromLookup(this, "Vpc", {
      vpcId: props.vpcId,
    })

    // No Griid for incub yet.
    const artifactsBucket = s3.Bucket.fromBucketName(
      this,
      "ArtifactsBucket",
      "incub-common-build-artifacts-001112238813-eu-west-1",
    )

    new pipelines.Pipeline(this, "RepoMetricsPipeline", {
      artifactsBucket,
      pipelineName: "incub-repo-metrics",
      environments: [
        {
          name: "incub",
          accountId: cdk.Stack.of(this).account,
        },
      ],
      vpc,
    })
  }
}

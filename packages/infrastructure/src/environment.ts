import * as cdk from "@aws-cdk/core"
import { applyTags, externalValues } from "./config"
import { RepoMetricsEdgeStack } from "./repo-metrics-edge-stack"
import { RepoMetricsStack } from "./repo-metrics-stack"

export class RepoMetricsEnv extends cdk.Stage {
  constructor(scope: cdk.Construct, id: string, props: cdk.StageProps) {
    super(scope, id, props)

    applyTags(this)

    const edgeStack = new RepoMetricsEdgeStack(
      this,
      "incub-repo-metrics-edge",
      {
        // Override since we added Stage after initial deploy.
        stackName: "incub-repo-metrics-edge",
        env: {
          region: "us-east-1",
        },
      },
    )

    new RepoMetricsStack(this, "incub-repo-metrics-main", {
      // Override since we added Stage after initial deploy.
      stackName: "incub-repo-metrics-main",
      userPoolId: externalValues.userPoolId,
      authLambdas: edgeStack.authLambdas,
      authDomain: externalValues.authDomain,
      reporterSlackWebhookUrlSecretName:
        "/incub/repo-metrics/reporter-slack-webhook-url",
    })
  }
}

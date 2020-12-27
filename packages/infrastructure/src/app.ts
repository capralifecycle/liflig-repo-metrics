import * as cdk from "@aws-cdk/core"
import { tagResources } from "@liflig/cdk"
import { PipelinesStack } from "./pipelines-stack"
import { RepoMetricsEdgeStack } from "./repo-metrics-edge-stack"
import { RepoMetricsStack } from "./repo-metrics-stack"

const accountId = "001112238813"

const externalValues = {
  // From https://github.com/capralifecycle/liflig-incubator-common-infra
  userPoolId: "eu-west-1_oGQHzXmbo",
  // From https://github.com/capralifecycle/liflig-incubator-common-infra
  authDomain: "cognito.incubator.liflig.dev",
  // From https://github.com/capralifecycle/liflig-incubator-common-infra
  vpcId: "vpc-0a67807e4aca6bb84",
}

const app = new cdk.App()
tagResources(app, (stack) => ({
  StackName: stack.stackName,
  Project: "repo-metrics",
  SourceRepo: "github/capralifecycle/liflig-repo-metrics",
}))

new PipelinesStack(app, "incub-repo-metrics-pipeline", {
  env: {
    account: accountId,
    region: "eu-west-1",
  },
  vpcId: externalValues.vpcId,
})

const edgeStack = new RepoMetricsEdgeStack(app, "incub-repo-metrics-edge", {
  env: {
    account: accountId,
    region: "us-east-1",
  },
})

new RepoMetricsStack(app, "incub-repo-metrics-main", {
  env: {
    account: accountId,
    region: "eu-west-1",
  },
  userPoolId: externalValues.userPoolId,
  authLambdas: edgeStack.authLambdas,
  authDomain: externalValues.authDomain,
})

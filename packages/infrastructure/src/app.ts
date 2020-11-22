import * as cdk from "@aws-cdk/core"
import { tagResources } from "@liflig/cdk"
import { RepoMetricsEdgeStack } from "./repo-metrics-edge-stack"
import { RepoMetricsStack } from "./repo-metrics-stack"

const accountId = "001112238813"

const externalValues = {
  // From https://github.com/capralifecycle/liflig-incubator-common-infra
  userPoolId: "eu-west-1_oGQHzXmbo",
  // From https://github.com/capralifecycle/liflig-incubator-common-infra
  authDomain: "cognito.incubator.liflig.dev",
}

const app = new cdk.App()
tagResources(app, (stack) => ({
  StackName: stack.stackName,
  Project: "repo-metrics",
  SourceRepo: "github/capralifecycle/liflig-repo-metrics",
}))

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

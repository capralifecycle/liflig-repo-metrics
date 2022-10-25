import * as constructs from "constructs"
import * as cdk from "aws-cdk-lib"
import * as lambda from "aws-cdk-lib/aws-lambda"
import { tagResources } from "@liflig/cdk"

export const incubatorAccountId = "001112238813"

export const externalValues = {
  // From https://github.com/capralifecycle/liflig-incubator-common-infra
  userPoolId: "eu-west-1_oGQHzXmbo",
  // From https://github.com/capralifecycle/liflig-incubator-common-infra
  authDomain: "cognito.incubator.liflig.dev",
  // From buildtools setup.
  jenkinsRoleArn:
    "arn:aws:iam::923402097046:role/buildtools-jenkins-RoleJenkinsSlave-JQGYHR5WE6C5",
}

export function applyTags(scope: constructs.Construct) {
  tagResources(scope, (stack) => ({
    StackName: stack.stackName,
    Project: "repo-metrics",
    SourceRepo: "github/capralifecycle/liflig-repo-metrics",
  }))
}

export function overrideLambdaRuntime(scope: constructs.IConstruct) {
  cdk.Aspects.of(scope).add({
    visit(construct: constructs.IConstruct) {
      if (
        construct.node.defaultChild instanceof lambda.CfnFunction &&
        (construct.node.scope?.node.id === "AuthLambdas" ||
          construct.node.scope?.node.id.startsWith("henrist."))
      ) {
        construct.node.defaultChild.addPropertyOverride("Runtime", "nodejs16.x")
      }
    },
  })
}

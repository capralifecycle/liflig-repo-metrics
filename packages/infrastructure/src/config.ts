import * as constructs from "constructs"
import * as cdk from "aws-cdk-lib"
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

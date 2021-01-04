import * as cdk from "@aws-cdk/core"
import { applyTags, incubatorAccountId } from "./config"
import { PipelineStack } from "./pipeline"

const app = new cdk.App()

applyTags(app)

new PipelineStack(app, "incub-repo-metrics-pipeline", {
  env: {
    account: incubatorAccountId,
    region: "eu-west-1",
  },
})

#!/usr/bin/env groovy

// See https://github.com/capralifecycle/jenkins-pipeline-library
@Library("cals") _

def pipelines = new no.capraconsulting.buildtools.lifligcdkpipelines.LifligCdkPipelines()

def artifactsBucketName = "incub-common-build-artifacts-001112238813-eu-west-1"
def artifactsRoleArn = "arn:aws:iam::001112238813:role/incub-common-build-artifacts-liflig-jenkins"

buildConfig(
  jobProperties: [
    parameters([
      booleanParam(
        defaultValue: false,
        description: "Skip branch check - force deploy to incubator",
        name: "incubOverrideBranchCheck"
      ),
    ])
  ],
  slack: [channel: "#cals-dev-info"],
) {
  dockerNode {
    checkout scm

    insideToolImage("node:18") {
      stage("Check repo-metrics") {
          sh "npm ci"
          sh "npm run build"
          sh "npm run lint"
          sh "npm run test"
      }

      dir("packages/infrastructure") {
        stage("Verify CDK snapshots") {
          sh """
            npm run snapshots
            git status
            git diff --exit-code
          """
        }

        def bucketKey

        stage("Package and upload Cloud Assembly") {
          bucketKey = pipelines.createAndUploadCloudAssembly(
            bucketName: artifactsBucketName,
            roleArn: artifactsRoleArn,
          )
        }

        def deployIncub = params.incubOverrideBranchCheck || env.BRANCH_NAME == "master"
        if (deployIncub) {
          stage("Trigger pipeline") {
            pipelines.configureAndTriggerPipelinesV2(
              cloudAssemblyBucketKey: bucketKey,
              artifactsBucketName: artifactsBucketName,
              artifactsRoleArn: artifactsRoleArn,
              pipelines: ["incub-repo-metrics"],
            )
          }
        }
      }
    }
  }
}

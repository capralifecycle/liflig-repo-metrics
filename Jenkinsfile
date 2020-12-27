#!/usr/bin/env groovy

// See https://github.com/capralifecycle/jenkins-pipeline-library
@Library("cals") _

def pipelines = new no.capraconsulting.buildtools.lifligcdkpipelines.LifligCdkPipelines()

def artifactsBucketName = "incub-common-build-artifacts-001112238813-eu-west-1"
def artifactsRoleArn = "arn:aws:iam::001112238813:role/incub-common-build-artifacts-ci"

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

    insideToolImage("node:14") {
      stage("Check repo-metrics") {
        sh "yarn install --frozen-lockfile"
        sh "yarn run build"
        sh "yarn run lint"
        sh "yarn run test"
      }

      dir("packages/infrastructure") {
        stage("Verify CDK snapshots") {
          sh """
            yarn run snapshots
            git status
            git diff --exit-code
          """
        }

        def bucketKey

        stage("Create Cloud Assembly") {
          bucketKey = pipelines.createAndUploadCloudAssembly(
            bucketName: artifactsBucketName,
            roleArn: artifactsRoleArn,
          )
        }

        def deployIncub = params.incubOverrideBranchCheck || env.BRANCH_NAME == "master"
        if (deployIncub) {
          stage("Trigger pipeline") {
            pipelines.configureAndTriggerPipelines(
              cloudAssemblyBucketKey: bucketKey,
              artifactsBucketName: artifactsBucketName,
              artifactsRoleArn: artifactsRoleArn,
              pipelines: [
                "incub-repo-metrics": [
                  environments: [
                    incub: [
                      "incub-repo-metrics-pipeline",
                      "incub-repo-metrics-edge",
                      "incub-repo-metrics-main",
                    ],
                  ],
                ],
              ],
            )
          }
        }
      }
    }
  }
}

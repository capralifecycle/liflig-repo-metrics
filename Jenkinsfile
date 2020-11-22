#!/usr/bin/env groovy

// See https://github.com/capralifecycle/jenkins-pipeline-library
@Library("cals") _

buildConfig(
  slack: [channel: "#cals-dev-info"]
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

        // TODO: Deploy it.
      }
    }
  }
}

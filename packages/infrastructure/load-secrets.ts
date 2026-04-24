#!/usr/bin/env bun

import { loadSecrets } from "@liflig/load-secrets"

const slackPipelineNotificationWebhookUrl: loadSecrets.Secret = {
  name: "slack-pipeline-webhook-url",
  description: "Incoming webhook URL for pipeline execution notifications",
  type: "string",
}

const githubAppSecret: loadSecrets.Secret = {
  name: "github-app",
  description:
    "GitHub App identity shared across all installations (appId, privateKey PEM)",
  type: "json",
  fields: [
    {
      key: "appId",
    },
    {
      key: "privateKey",
    },
  ],
}

const githubAppInstallCapralifecycleSecret: loadSecrets.Secret = {
  name: "github-app-install-capralifecycle",
  description: "GitHub App installation ID for the capralifecycle org",
  type: "string",
}

const snykTokenSecret: loadSecrets.Secret = {
  name: "snyk-token",
  description: "Snyk token",
  type: "json",
  fields: [
    {
      key: "token",
    },
  ],
}

const sonarCloudTokenSecret: loadSecrets.Secret = {
  name: "sonarcloud-token",
  description: "SonarCloud token",
  type: "json",
  fields: [
    {
      key: "token",
    },
  ],
}

const reporterSlackWebhookUrlSecret: loadSecrets.Secret = {
  name: "reporter-slack-webhook-url",
  description: "Slack Webhook URL for data reporting",
  type: "json",
  fields: [
    {
      key: "url",
    },
  ],
}

loadSecrets.loadSecretsCli({
  secretGroups: [
    {
      accountId: "001112238813",
      region: "eu-west-1",
      description: "incub",
      namePrefix: "/incub/repo-metrics/",
      secrets: [
        githubAppSecret,
        githubAppInstallCapralifecycleSecret,
        snykTokenSecret,
        reporterSlackWebhookUrlSecret,
        slackPipelineNotificationWebhookUrl,
        sonarCloudTokenSecret,
      ],
    },
  ],
})

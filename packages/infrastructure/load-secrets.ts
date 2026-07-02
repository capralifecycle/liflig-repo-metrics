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

const aikidoClientSecret: loadSecrets.Secret = {
  name: "aikido-client",
  description: "Aikido REST API client credentials (client id + secret)",
  type: "json",
  fields: [
    {
      key: "clientId",
    },
    {
      key: "clientSecret",
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
        aikidoClientSecret,
        githubAppSecret,
        reporterSlackWebhookUrlSecret,
        slackPipelineNotificationWebhookUrl,
        sonarCloudTokenSecret,
      ],
    },
  ],
})

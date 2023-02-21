import { loadSecrets } from "@capraconsulting/cals-cli"

const githubTokenSecret: loadSecrets.Secret = {
  name: "github-token",
  description: "GitHub token",
  type: "json",
  fields: [
    {
      key: "token",
    },
  ],
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

const cicdSlackWebhookUrlSecret: loadSecrets.Secret = {
  name: "cicd-slack-webhook-url",
  description: "Slack Webhook URL for CICD purpose",
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
        githubTokenSecret,
        snykTokenSecret,
        reporterSlackWebhookUrlSecret,
        cicdSlackWebhookUrlSecret,
        sonarCloudTokenSecret,
      ],
    },
  ],
})

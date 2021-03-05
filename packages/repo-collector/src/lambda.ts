import { SecretsManager } from "@aws-sdk/client-secrets-manager"
import { GitHubTokenProvider } from "@capraconsulting/cals-cli/lib/github/token"
import { SnykTokenProvider } from "@capraconsulting/cals-cli/lib/snyk/token"
import { Handler } from "aws-lambda"
import {
  generateMessage,
  getReporterDetails,
  sendSlackMessage,
} from "./reporter/reporter"
import { collect } from "./snapshots/collect"
import { S3SnapshotsRepository } from "./snapshots/snapshots-repository"
import {
  createWebappFriendlyFormat,
  retrieveSnapshotsForWebappAggregation,
} from "./webapp/webapp"
import { S3WebappDataRepository } from "./webapp/webapp-data-repository"

async function getSecretValue(
  secretId: string,
): Promise<Record<string, string>> {
  const client = new SecretsManager({})
  const secret = await client.getSecretValue({
    SecretId: secretId,
  })

  if (secret.SecretString == null) {
    throw new Error(`Secret value not found for ${secretId}`)
  }

  return JSON.parse(secret.SecretString) as Record<string, string>
}

function requireEnv(name: string): string {
  const result = process.env[name]
  if (result == null) {
    throw new Error(`Missing ${name} env`)
  }
  return result
}

async function getGithubTokenProvider(): Promise<GitHubTokenProvider> {
  const githubTokenSecretId = requireEnv("GITHUB_TOKEN_SECRET_ID")
  const githubToken = (await getSecretValue(githubTokenSecretId))["token"]

  return {
    getToken: () => Promise.resolve(githubToken),
    markInvalid: () => Promise.resolve(),
  }
}

async function getSnykTokenProvider(): Promise<SnykTokenProvider> {
  const snykTokenSecretId = requireEnv("SNYK_TOKEN_SECRET_ID")
  const snykToken = (await getSecretValue(snykTokenSecretId))["token"]

  return {
    getToken: () => Promise.resolve(snykToken),
    markInvalid: () => Promise.resolve(),
  }
}

export const collectHandler: Handler = async () => {
  const dataBucketName = requireEnv("DATA_BUCKET_NAME")
  const snapshotsRepository = new S3SnapshotsRepository(dataBucketName)

  await collect(
    snapshotsRepository,
    await getGithubTokenProvider(),
    await getSnykTokenProvider(),
  )
}

export const aggregateHandler: Handler = async () => {
  const dataBucketName = requireEnv("DATA_BUCKET_NAME")
  const webappDataBucketName = requireEnv("WEBAPP_DATA_BUCKET_NAME")
  const cfDistributionId = requireEnv("CF_DISTRIBUTION_ID")

  const snapshotsRepository = new S3SnapshotsRepository(dataBucketName)
  const webappDataRepository = new S3WebappDataRepository(
    webappDataBucketName,
    cfDistributionId,
  )

  const snapshots = await retrieveSnapshotsForWebappAggregation(
    snapshotsRepository,
  )
  const webappFriendly = createWebappFriendlyFormat(snapshots)
  await webappDataRepository.store(webappFriendly)
}

export const reportHandler: Handler = async () => {
  const dataBucketName = requireEnv("DATA_BUCKET_NAME")
  const slackWebhookUrl = requireEnv("SLACK_WEBHOOK_URL")

  const snapshotsRepository = new S3SnapshotsRepository(dataBucketName)

  const details = await getReporterDetails(snapshotsRepository)

  if (details == null) {
    console.log("No data found to generate details")
    return
  }

  const message = generateMessage(details)
  await sendSlackMessage(slackWebhookUrl, message)
}

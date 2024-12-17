import { SecretsManager } from "@aws-sdk/client-secrets-manager"
import type { GitHubTokenProvider } from "./github/token"
import type { SnykTokenProvider } from "./snyk/token"
import type { SonarCloudTokenProvider } from "./sonarcloud/token"
import type { Handler } from "aws-lambda"
import { Temporal } from "@js-temporal/polyfill"
import { isWorkingDay } from "./dates"
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

async function getSonarCloudTokenProvider(): Promise<SonarCloudTokenProvider> {
  const sonarCloudTokenSecretId = requireEnv("SONARCLOUD_TOKEN_SECRET_ID")
  const sonarCloudToken = (await getSecretValue(sonarCloudTokenSecretId))[
    "token"
  ]

  return {
    getToken: () => Promise.resolve(sonarCloudToken),
    markInvalid: () => Promise.resolve(),
  }
}

// noinspection JSUnusedGlobalSymbols
export const collectHandler: Handler = async () => {
  console.log("Collecting data for aggregation")

  const dataBucketName = requireEnv("DATA_BUCKET_NAME")
  console.log("Data bucket name: ", dataBucketName)

  console.log("Initializing repository for snapshot data")
  const snapshotsRepository = new S3SnapshotsRepository(dataBucketName)

  console.log("Collecting data")
  await collect(
    snapshotsRepository,
    await getGithubTokenProvider(),
    await getSnykTokenProvider(),
    await getSonarCloudTokenProvider(),
  )
  console.log("Done.")
}

// noinspection JSUnusedGlobalSymbols
export const aggregateHandler: Handler = async () => {
  console.log("Aggregating data for webapp")

  const dataBucketName = requireEnv("DATA_BUCKET_NAME")
  const webappDataBucketName = requireEnv("WEBAPP_DATA_BUCKET_NAME")
  const cfDistributionId = requireEnv("CF_DISTRIBUTION_ID")

  const envVars = {
    dataBucketName: dataBucketName,
    webappDataBucketName: webappDataBucketName,
    cfDistributionId: cfDistributionId,
  }

  console.log(JSON.stringify(envVars))

  console.log("Initializing repositories for snapshot and webapp data")
  const snapshotsRepository = new S3SnapshotsRepository(dataBucketName)
  const webappDataRepository = new S3WebappDataRepository(
    webappDataBucketName,
    cfDistributionId,
  )

  console.log("Retrieving snapshots for webapp aggregation")
  const snapshots =
    await retrieveSnapshotsForWebappAggregation(snapshotsRepository)

  console.log("Converting snapshot data into a webapp friendly format")
  const webappFriendly = createWebappFriendlyFormat(snapshots)

  console.log("Storing webapp data")
  await webappDataRepository.store(webappFriendly)

  console.log("Done.")
}

// noinspection JSUnusedGlobalSymbols
export const reportHandler: Handler = async () => {
  // Don't report on non-working days.
  if (!isWorkingDay(Temporal.Now.plainDateISO("UTC"))) {
    console.log("Non working day detected - skipping")
    return
  }

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

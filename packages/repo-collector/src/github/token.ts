import * as process from "node:process"
import { SecretsManager } from "@aws-sdk/client-secrets-manager"
import { createAppAuth } from "@octokit/auth-app"
import { Octokit } from "@octokit/rest"

type OctokitAuthOptions = {
  authStrategy: typeof createAppAuth
  auth: {
    appId: string
    privateKey: string
    installationId: number
  }
}

export interface GitHubAuthProvider {
  getOctokitAuthOptions(): Promise<OctokitAuthOptions>
  getToken(): Promise<string>
  markInvalid(): Promise<void>
}

interface AppCredentials {
  appId: string
  privateKey: string
  installationId: number
  orgName: string
}

export class GitHubAppProvider implements GitHubAuthProvider {
  private readonly auth: ReturnType<typeof createAppAuth>

  constructor(private readonly creds: AppCredentials) {
    this.auth = createAppAuth({
      appId: creds.appId,
      privateKey: creds.privateKey,
      installationId: creds.installationId,
    })
    console.log(
      `[github-auth] using GitHub App installation (appId=${creds.appId}, org=${creds.orgName}, installationId=${creds.installationId})`,
    )
  }

  async getOctokitAuthOptions(): Promise<OctokitAuthOptions> {
    return {
      authStrategy: createAppAuth,
      auth: {
        appId: this.creds.appId,
        privateKey: this.creds.privateKey,
        installationId: this.creds.installationId,
      },
    }
  }

  async getToken(): Promise<string> {
    const { token } = await this.auth({ type: "installation" })
    return token
  }

  async markInvalid(): Promise<void> {
    // Installation tokens auto-refresh via @octokit/auth-app; nothing to do.
  }
}

const DEFAULT_APP_SECRET_ID = "/incub/repo-metrics/github-app"
const DEFAULT_ORG_NAME = "capralifecycle"

export async function loadGitHubAppProviderFromSecrets(opts?: {
  appSecretId?: string
  orgName?: string
}): Promise<GitHubAppProvider> {
  const appSecretId =
    opts?.appSecretId ??
    process.env.GITHUB_APP_SECRET_ID ??
    DEFAULT_APP_SECRET_ID
  const orgName =
    opts?.orgName ?? process.env.GITHUB_APP_ORG ?? DEFAULT_ORG_NAME

  const client = new SecretsManager({})
  const appSecret = await readJsonSecret(client, appSecretId)
  const { appId, privateKey } = appSecret

  if (!appId) {
    throw new Error(`Missing "appId" field in secret ${appSecretId}`)
  }
  if (!privateKey) {
    throw new Error(`Missing "privateKey" field in secret ${appSecretId}`)
  }

  const installationId = await discoverInstallationId({
    appId,
    privateKey,
    orgName,
  })

  return new GitHubAppProvider({ appId, privateKey, installationId, orgName })
}

async function discoverInstallationId(args: {
  appId: string
  privateKey: string
  orgName: string
}): Promise<number> {
  const appOctokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: args.appId,
      privateKey: args.privateKey,
    },
  })

  try {
    const { data } = await appOctokit.request("GET /orgs/{org}/installation", {
      org: args.orgName,
    })
    return data.id
  } catch (err) {
    const status = (err as { status?: number }).status
    if (status === 404) {
      throw new Error(
        `GitHub App is not installed on org "${args.orgName}". Install the App on the org and retry.`,
      )
    }
    throw err
  }
}

async function readJsonSecret(
  client: SecretsManager,
  secretId: string,
): Promise<Record<string, string>> {
  const result = await client.getSecretValue({ SecretId: secretId })
  if (result.SecretString == null) {
    throw new Error(`Secret ${secretId} has no SecretString`)
  }
  return JSON.parse(result.SecretString) as Record<string, string>
}

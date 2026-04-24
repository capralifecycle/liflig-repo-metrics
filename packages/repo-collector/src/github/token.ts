import * as process from "node:process"
import { SecretsManager } from "@aws-sdk/client-secrets-manager"
import { createAppAuth } from "@octokit/auth-app"

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
      `[github-auth] using GitHub App installation (appId=${creds.appId}, installationId=${creds.installationId})`,
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
const DEFAULT_INSTALL_SECRET_ID =
  "/incub/repo-metrics/github-app-install-capralifecycle"

export async function loadGitHubAppProviderFromSecrets(opts?: {
  appSecretId?: string
  installSecretId?: string
}): Promise<GitHubAppProvider> {
  const appSecretId =
    opts?.appSecretId ??
    process.env.GITHUB_APP_SECRET_ID ??
    DEFAULT_APP_SECRET_ID
  const installSecretId =
    opts?.installSecretId ??
    process.env.GITHUB_APP_INSTALL_SECRET_ID ??
    DEFAULT_INSTALL_SECRET_ID

  const client = new SecretsManager({})

  const [appSecret, installationIdRaw] = await Promise.all([
    readJsonSecret(client, appSecretId),
    readStringSecret(client, installSecretId),
  ])

  const { appId, privateKey } = appSecret

  if (!appId) {
    throw new Error(`Missing "appId" field in secret ${appSecretId}`)
  }
  if (!privateKey) {
    throw new Error(`Missing "privateKey" field in secret ${appSecretId}`)
  }
  const installationId = Number(installationIdRaw)
  if (!Number.isFinite(installationId)) {
    throw new Error(
      `Secret ${installSecretId} is not a number: ${installationIdRaw}`,
    )
  }

  return new GitHubAppProvider({ appId, privateKey, installationId })
}

async function readStringSecret(
  client: SecretsManager,
  secretId: string,
): Promise<string> {
  const result = await client.getSecretValue({ SecretId: secretId })
  if (result.SecretString == null) {
    throw new Error(`Secret ${secretId} has no SecretString`)
  }
  return result.SecretString
}

async function readJsonSecret(
  client: SecretsManager,
  secretId: string,
): Promise<Record<string, string>> {
  return JSON.parse(await readStringSecret(client, secretId)) as Record<
    string,
    string
  >
}

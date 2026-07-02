export interface AikidoCredentials {
  clientId: string
  clientSecret: string
}

/**
 * Supplies the Aikido REST API client credentials (client id + secret). The
 * short-lived access token exchange itself lives in `AikidoService`, mirroring
 * how the SonarCloud service owns its request auth.
 */
export interface AikidoCredentialsProvider {
  getCredentials(): Promise<AikidoCredentials>
}

/**
 * Reads credentials from `AIKIDO_CLIENT_ID` / `AIKIDO_CLIENT_SECRET`, for local
 * CLI runs. Mirrors `SonarCloudTokenCliProvider`.
 */
export class AikidoCredentialsCliProvider implements AikidoCredentialsProvider {
  async getCredentials(): Promise<AikidoCredentials> {
    const clientId = process.env.AIKIDO_CLIENT_ID
    const clientSecret = process.env.AIKIDO_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      console.error(
        "Missing required environment variables: AIKIDO_CLIENT_ID and AIKIDO_CLIENT_SECRET",
      )
      process.exit(1)
    }
    return { clientId, clientSecret }
  }
}

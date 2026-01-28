export interface SonarCloudTokenProvider {
  getToken(): Promise<string>
  markInvalid(): Promise<void>
}

export class SonarCloudTokenCliProvider implements SonarCloudTokenProvider {
  async getToken(): Promise<string> {
    const token = process.env.SONARCLOUD_TOKEN
    if (!token) {
      console.error("Missing required environment variable: SONARCLOUD_TOKEN")
      process.exit(1)
    }
    return token
  }

  async markInvalid(): Promise<void> {
    // No-op for env var based tokens
  }
}

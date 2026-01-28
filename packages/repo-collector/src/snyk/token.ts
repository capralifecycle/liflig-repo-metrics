export interface SnykTokenProvider {
  getToken(): Promise<string>
  markInvalid(): Promise<void>
}

export class SnykTokenCliProvider implements SnykTokenProvider {
  async getToken(): Promise<string> {
    const token = process.env.SNYK_TOKEN
    if (!token) {
      console.error("Missing required environment variable: SNYK_TOKEN")
      process.exit(1)
    }
    return token
  }

  async markInvalid(): Promise<void> {
    // No-op for env var based tokens
  }
}

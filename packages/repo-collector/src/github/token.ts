export interface GitHubTokenProvider {
  getToken(): Promise<string>
  markInvalid(): Promise<void>
}

export class GitHubTokenCliProvider implements GitHubTokenProvider {
  async getToken(): Promise<string> {
    const token = process.env.GITHUB_TOKEN
    if (!token) {
      console.error("Missing required environment variable: GITHUB_TOKEN")
      process.exit(1)
    }
    return token
  }

  async markInvalid(): Promise<void> {
    // No-op for env var based tokens
  }
}

// This is based on VulnerabilityAlert from cals-cli but
// duplicated so we can keep it persisted and have control
// over changes.
export interface MetricRepoGitHubVulnerabilityAlert {
  dismissReason: string | null
  vulnerableManifestFilename: string
  vulnerableManifestPath: string
  vulnerableRequirements: string | null
  securityAdvisory: {
    description: string
    identifiers: Array<{
      type: string
      value: string
    }>
    references: Array<{
      url: string
    }>
    severity: "CRITICAL" | "HIGH" | "LOW" | "MODERATE"
  } | null
  securityVulnerability: {
    package: {
      name: string
      ecosystem:
        | "COMPOSER"
        | "MAVEN"
        | "NPM"
        | "NUGET"
        | "PIP"
        | "RUBYGEMS"
        | string
    }
    firstPatchedVersion: {
      identifier: string
    }
    vulnerableVersionRange: string
  } | null
}

/**
 * A snapshot of a specific repo with embedded related details.
 */
export interface MetricRepoSnapshot {
  version: "1"
  timestamp: string
  repoId: string
  responsible?: string
  github: {
    orgName: string
    repoName: string
    prs: {
      number: number
      author: {
        login: string
      }
      title: string
      createdAt: string
      updatedAt: string
    }[]
    vulnerabilityAlerts: MetricRepoGitHubVulnerabilityAlert[]
    renovateDependencyDashboardIssue: {
      number: number
      body: string
    } | null
  }
  snyk: {
    projects: {
      name: string
      id: string
      created: string
      origin: string
      type: string
      testFrequency: string
      totalDependencies: number
      issueCountsBySeverity: {
        low: number
        high: number
        medium: number
      }
    }[]
  }
}

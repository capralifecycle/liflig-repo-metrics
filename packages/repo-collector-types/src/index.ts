// This is based on VulnerabilityAlert from cals-cli but
// duplicated so we can keep it persisted and have control
// over changes.
export interface MetricRepoGitHubVulnerabilityAlert {
  dismissReason: string | null
  state: "DISMISSED" | "FIXED" | "OPEN"
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
  version: "1.1"
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
      // Added 2020-11-22.
      lastUpdatedByRenovate?: string | null
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
        critical?: number
        high: number
        medium: number
        low: number
      }
      browseUrl: string
    }[]
  }
}

export interface WebappMetricDataRepoDatapoint {
  timestamp: string
  github: {
    renovateDependencyDashboard: {
      issueNumber: number
      daysSinceLastUpdate: number | null
    } | null
    prs: {
      number: number
      author: string
      title: string
      createdAt: string
    }[]
    vulnerabilityAlerts: {
      vulnerableManifestPath: string
      severity?: "CRITICAL" | "HIGH" | "LOW" | "MODERATE"
      packageName: string
    }[]
    availableUpdates?: {
      categoryName: string
      isActionable: boolean
      updates: {
        name: string
        toVersion: string
      }[]
    }[]
  }
  snyk?: {
    totalIssues: number
    countsBySeverity: {
      critical?: number
      high: number
      medium: number
      low: number
    }
    vulnerableProjects: {
      path: string
      browseUrl: string
    }[]
  }
}

export interface WebappStatsByFetchGroup {
  timestamp: string
  repos: {
    repoId: string
    responsible: string
    updates: number
    githubVulnerabilities: number
    snykVulnerabilities: number
  }[]
}

export interface WebappMetricDataRepo {
  repoId: string
  responsible?: string
  github: {
    orgName: string
    repoName: string
  }
  lastDatapoint: WebappMetricDataRepoDatapoint
}

/**
 * Data for webapp.
 */
export interface WebappMetricData {
  byFetchGroup: WebappStatsByFetchGroup[]
  repos: WebappMetricDataRepo[]
}

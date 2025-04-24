// This is based on VulnerabilityAlert from cals-cli but
// duplicated so we can keep it persisted and have control
// over changes.

/**
 * A snapshot of all repos with embedded related details.
 *
 * This is stored in the snapshot repository and later used for aggregation
 * into a webapp-friendly format.
 */
export interface SnapshotData {
  timestamp: string
  metrics: SnapshotMetrics[]
}

/**
 * A snapshot of a specific repo with embedded related details.
 */
export interface SnapshotMetrics {
  version: "1.2"
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
    vulnerabilityAlerts: GitHubVulnerabilityAlerts[]
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
  sonarCloud?: {
    component: {
      id: string
      key: string
      name: string
      qualifier: string
      measures: {
        metric: string
        value: string
      }[]
    }
  }
}

export interface SnykProject {
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
}

export interface GitHubVulnerabilityAlerts {
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
 * Data for webapp.
 */
export interface WebappData {
  collectedAt: string
  aggregatedAt: string
  repos: Repo[]
}

/**
 * Core and Metric data for a single repository.
 * Constructed using data from snapshots.
 */
export interface Repo {
  id: string
  org: string
  name: string
  responsible?: string
  metrics: Metrics
}

export interface Metrics {
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
  sonarCloud: {
    /**
     * Describes whether SonarCloud is configured for the GitHub repository in question.
     */
    enabled: boolean
    /**
     * Undefined means that no test coverage has been set up
     */
    testCoverage?: string
  }
}

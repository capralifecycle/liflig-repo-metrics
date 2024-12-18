// See https://developer.github.com/v4/object/repositoryvulnerabilityalert/
export interface VulnerabilityAlert {
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
      url: string // URI
    }>
    severity: "CRITICAL" | "HIGH" | "LOW" | "MODERATE"
  } | null
  securityVulnerability: {
    package: {
      name: string
      ecosystem: "COMPOSER" | "MAVEN" | "NPM" | "NUGET" | "PIP" | "RUBYGEMS"
    }
    firstPatchedVersion: {
      identifier: string
    }
    vulnerableVersionRange: string
  } | null
}

export type Permission = "admin" | "push" | "pull"

export interface RenovateDependencyDashboardIssue {
  number: number
  body: string
  lastUpdatedByRenovate: string | null
}

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
  customer?: string
  system?: string
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
    renovateDependencyDashboardIssue: {
      number: number
      body: string
      // Added 2020-11-22.
      lastUpdatedByRenovate?: string | null
    } | null
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
  // Added 2026-07: Aikido security. Absent on snapshots collected before the
  // integration; consumers must treat it as optional.
  aikido?: AikidoMetrics
}

export type AikidoSeverity = "critical" | "high" | "medium" | "low"

/**
 * Aikido issue groups for a single repo, embedded in a snapshot.
 *
 * Issues are deduplicated to their issue group (Aikido's own grouping of the
 * same underlying finding across files), keeping the highest severity seen for
 * the group. Only security-relevant issue types are included (see
 * `ISSUE_TYPES` in `aikido/service.ts`).
 */
export interface AikidoMetrics {
  /** Whether the repo is onboarded in Aikido (present in its code repo list). */
  enabled: boolean
  /** The repo's Aikido id, used to deep-link into its issues. Null when disabled. */
  repoId: number | null
  issueGroups: AikidoIssueGroup[]
  /** Number of ignored (open but muted) issue groups for the repo. */
  ignoredCount: number
}

export interface AikidoIssueGroup {
  /** The issue group id — Aikido's queue/sidebar deep-links key on this. */
  groupId: number
  severity: AikidoSeverity
  /** e.g. open_source, sast, leaked_secret, iac, cloud, malware, eol. */
  type: string
  /** Human-readable title as shown in Aikido, e.g. "fast-uri", "3 exposed secrets". */
  title: string
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
  customer?: string
  system?: string
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
    availableUpdates?: {
      categoryName: string
      isActionable: boolean
      updates: {
        name: string
        toVersion: string
      }[]
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
  aikido: {
    /** Whether the repo is onboarded in Aikido. `false` renders as "no data". */
    enabled: boolean
    /** The repo's Aikido id, for deep-linking issues. Null when disabled. */
    repoId: number | null
    /** Ignored (muted) issue groups, shown separately from the open counts. */
    ignoredCount: number
    /** Deduplicated open issue groups. */
    issues: {
      groupId: number
      severity: AikidoSeverity
      type: string
      title: string
    }[]
  }
}

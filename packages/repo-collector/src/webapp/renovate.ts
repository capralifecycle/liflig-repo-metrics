import { Temporal } from "proposal-temporal"

// https://github.com/renovatebot/renovate/blob/96f87bd2f49e5d6ef135eb25c42b2b1e91f83537/lib/workers/repository/dependency-dashboard.ts
type UpdateCategoryName =
  | "Pending Approval"
  | "Awaiting Schedule"
  | "Rate Limited"
  | "Errored"
  | "PR Creation Approval Required"
  | "Edited/Blocked"
  | "Pending Status Checks"
  | "Open"
  | "Ignored or Blocked"
  // Our own fallback value.
  | "unknown"

interface Update {
  name: string
  toVersion: string
}

export interface UpdateCategory {
  name: UpdateCategoryName
  updates: Update[]
}

export function isUpdateCategoryActionable(value: UpdateCategoryName): boolean {
  return ![
    "Awaiting Schedule",
    "Pending Status Checks",
    "Ignored or Blocked",
  ].includes(value)
}

function extractUpdates(body: string): Update[] {
  // example: [fix(deps): update react monorepo to v17 (major)]

  const result: Update[] = []

  const matches = body.matchAll(
    /update (?:dependency )?(.+?) to (.+?)( \(|\]|$)/gm,
  )
  for (const match of matches) {
    result.push({
      name: match[1],
      toVersion: match[2],
    })
  }

  return result.sort((a, b) => a.name.localeCompare(b.name))
}

export function extractDependencyUpdatesFromIssue(
  body: string,
): UpdateCategory[] {
  const sections = body.split(/^(?=## )/gm)
  const categories: UpdateCategory[] = []

  for (const section of sections) {
    const name = section.startsWith("## ")
      ? (section.split("\n")[0].slice(3) as UpdateCategoryName)
      : "unknown"

    const updates = extractUpdates(section)
    if (updates.length > 0) {
      categories.push({
        name,
        updates,
      })
    }
  }

  return categories
}

export function calculateRenovateLastUpdateInDays(
  now: Temporal.Instant,
  lastUpdated: Temporal.Instant,
): number {
  return lastUpdated
    .toZonedDateTimeISO("UTC")
    .until(now.toZonedDateTimeISO("UTC"), { largestUnit: "days" }).days
}

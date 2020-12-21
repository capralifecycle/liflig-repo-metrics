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

interface Update {
  name: string
  toVersion: string
}

export interface UpdateCategory {
  name: string
  updates: Update[]
}

export function isUpdateCategoryActionable(value: string): boolean {
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
      ? section.split("\n")[0].slice(3)
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
  now: Date,
  lastUpdated: Date,
): number {
  return Math.floor((now.getTime() - lastUpdated.getTime()) / 86400000)
}

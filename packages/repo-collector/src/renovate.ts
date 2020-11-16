interface Update {
  name: string
  toVersion: string
}

export function extractDependencyUpdatesFromIssue(body: string) {
  // example: [fix(deps): update react monorepo to v17 (major)]

  const result: Update[] = []

  const matches = body.matchAll(
    /update (?:dependency )?(.+?) to (.+?)( \(|\]|$)/g,
  )
  for (const match of matches) {
    result.push({
      name: match[1],
      toVersion: match[2],
    })
  }

  return result.sort((a, b) => a.name.localeCompare(b.name))
}

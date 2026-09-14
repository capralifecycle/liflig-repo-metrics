/**
 * Resolves the current commit hash at bundle time.
 *
 * Imported with `with { type: "macro" }` so the call is evaluated by the
 * bundler and the result inlined as a string literal. This runs in both
 * `bun build` and the dev server, so the value never has to be threaded
 * through build configuration.
 */
export function commitHash(): string {
  const { stdout } = Bun.spawnSync(["git", "rev-parse", "--short", "HEAD"])
  return new TextDecoder().decode(stdout).trim()
}

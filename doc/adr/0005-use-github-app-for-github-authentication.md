# 5. use github app for github authentication

Date: 2026-04-24

## Status

Accepted

## Context

The collector originally authenticated to GitHub using a classic personal access token (PAT) stored in AWS Secrets Manager. PATs are tied to an individual user account, inherit all of that user's repo permissions (coarse scope), are long-lived, and break whenever the user leaves the organisation or the token expires.

Repo Metrics may also need to scan repositories in GitHub organisations we do not administer. In such organisations:

- We cannot install apps or add members at the org level without the org admin's involvement.
- SAML SSO enforcement requires PATs to be SSO-authorised per user, per org, which is operationally painful and user-tied.
- Even if a PAT worked, it would be scoped to *every* repo the user can see in that org, not just the ones we are interested in.

This makes PATs a bad fit both in the current setup (fragile identity, blast radius) and for any future expansion to other organisations.

## Decision

The collector authenticates to GitHub using a **GitHub App** with **installation access tokens** (server-to-server auth). A single public App is registered in `capralifecycle`. Each target org installs the App, scoped to the specific repos it should grant access to.

At runtime the collector:

1. Loads the App's private key and the target installation ID from AWS Secrets Manager.
2. Signs a short-lived JWT with the private key and exchanges it for an installation access token via GitHub's API (handled transparently by `@octokit/auth-app`).
3. Uses the installation token for all API calls. Tokens expire after ~1 hour and are auto-rotated by the library.

Credentials are split across two secrets so the App identity can be reused across installations:

- `/incub/repo-metrics/github-app` — `{ appId, privateKey }`, shared.
- `/incub/repo-metrics/github-app-install-<org>` — the per-installation ID.

## Consequences

Positive:

- Access is scoped per installation to an explicit list of repos; we cannot accidentally read anything else in the target org.
- Tokens in flight live ~1 hour and rotate automatically. The long-lived credential is the App's private key, which can be rotated zero-downtime (GitHub allows two active keys).
- GitHub API calls are attributed to the App's bot identity in audit logs, not to any individual. No breakage when someone leaves.
- Dedicated rate limits (5k/hr per installation) instead of a per-user budget shared with the user's other tooling.
- The same App can be installed on additional organisations, so adding another one is a configuration change (new installation ID secret) rather than a code change.

Negative / operational:

- The private key is a higher-leverage secret than a PAT (it can mint tokens for every installation), so Secrets Manager hygiene matters more. See [Rotating the GitHub App private key](../../README.md#rotating-the-github-app-private-key).
- Local development now requires AWS credentials to read the App secrets, where it previously only required a `GITHUB_TOKEN` env var.
- Installation IDs are per-org, so supporting additional organisations requires one installation secret per org (or runtime discovery via `GET /orgs/{org}/installation`).
- Installing the App on a restricted org (GitHub App access restrictions enabled) still requires a one-time approval from the org's admin.

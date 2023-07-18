# Repo Collector

This package produces 3 lambdas:

1. A collector that dumps github and snyk info to a s3 data bucket as new files
2. An aggregator that appends the collected data onto a large json file in a webapp data bucket.  
   It also invalidates the CloudFront distribution for the data read by the frontend.
3. A reporter that notifies slack with Repo-Metrics data

The lambdas are scheduled to run sequentially by EventBridge Cron jobs with offsets.  
Collector runs every 6th hour, then Aggregator 10 minutes past every 6th hour, and reporter every 7th hour.  
(This is configured in the [infra stack](../infrastructure/src/repo-metrics-stack.ts).)

## Tokens and Permissions

### Github

| Repository permissions  (**Read-only**) | Reason                                           |
|-----------------------------------------|--------------------------------------------------|
| Administration                          | ?                                                |
| Code scanning alerts                    | ?                                                |
| Commit statuses                         | ?                                                |
| Contents                                | Read `resources.yaml` in `resources-definition`. |
| Dependabot alerts                       | ?                                                |
| Dependabot secrest                      | ?                                                |
| Deployments                             | ?                                                |
| Discussions                             | ?                                                |
| Environments                            | ?                                                |
| Issues                                  | Find Dependabot issue with open PRs              |
| Metadata                                | ?                                                |
| Pages                                   | ?                                                |
| Pull requests                           | Show count of PRs                                |
| Repository security advisories          | ?                                                |
| Secret scanning alerts                  | ?                                                |

| Organization permissions (**Read-only**) | Reason |
|------------------------------------------|--------|
| Administration                           | ?      |
| Members                                  | ?      |
| Organization dependabot secrets          | ?      |

## Snyk

?

## SonarCloud

?

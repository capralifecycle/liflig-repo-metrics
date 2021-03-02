#!/bin/bash
set -eu

echo "Copy paste the snippets, edit and run manually."
exit 1

aws secretsmanager create-secret \
  --name "/incub/repo-metrics/github-token" \
  --secret-string '{"token":"REPLACE-ME"}' \
  --tags \
    Key=Project,Value=repo-metrics \
    Key=SourceRepo,Value=github/capralifecycle/liflig-repo-metrics \
    Key=StackName,Value=SCRIPTED

aws secretsmanager create-secret \
  --name "/incub/repo-metrics/snyk-token" \
  --secret-string '{"token":"REPLACE-ME"}' \
  --tags \
    Key=Project,Value=repo-metrics \
    Key=SourceRepo,Value=github/capralifecycle/liflig-repo-metrics \
    Key=StackName,Value=SCRIPTED

aws secretsmanager create-secret \
  --name "/incub/repo-metrics/reporter-slack-webhook-url" \
  --secret-string '{"url":"REPLACE-ME"}' \
  --tags \
    Key=Project,Value=repo-metrics \
    Key=SourceRepo,Value=github/capralifecycle/liflig-repo-metrics \
    Key=StackName,Value=SCRIPTED

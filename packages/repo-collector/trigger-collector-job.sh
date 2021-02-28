#!/bin/bash
set -eu

aws-vault exec liflig-incubator-admin -- \
  aws lambda invoke \
     --function-name incub-repo-metrics-main-Collector9EBA7CF5-1PVWAMAFCF1ZJ \
     /tmp/out

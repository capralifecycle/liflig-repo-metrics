#!/bin/bash
set -euo pipefail

aws-vault exec liflig-incubator-admin -- \
  aws lambda invoke \
     --function-name incub-repo-metrics-main-Aggregator84F1B3DF-17LMXCOQOEV3X \
     /tmp/out

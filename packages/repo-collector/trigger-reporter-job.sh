#!/bin/bash
set -eu

aws-vault exec liflig-incubator-admin -- \
  aws lambda invoke \
     --function-name incub-repo-metrics-main-Reporter08098DAC-C9RWKUXU83NR \
     /tmp/out

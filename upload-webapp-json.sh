#!/bin/bash
set -eu

# Outputs from CDK.
bucket_name=incub-repo-metrics-main-databuckete3889a50-14geergoysuv4
cloudfront_distribution_id=EVV8GMZ9FY1ZL

aws s3 cp packages/repo-collector/data/webapp.json "s3://$bucket_name/data/webapp.json"

aws cloudfront create-invalidation --distribution-id="$cloudfront_distribution_id" --paths "/data/*"

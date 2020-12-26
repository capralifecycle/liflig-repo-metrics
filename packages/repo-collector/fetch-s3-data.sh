#!/bin/bash
set -eu

# Outputs from CDK.
data_bucket_name=incub-repo-metrics-main-databuckete3889a50-14geergoysuv4
webapp_data_bucket_name=incub-repo-metrics-main-webappdatabucket777722b9-amcc1ksidoqu

aws s3 cp s3://$data_bucket_name/snapshots/ data/snapshots --recursive
aws s3 cp s3://$webapp_data_bucket_name/data/webapp.json data/webapp.json

# repo-metrics

https://d2799m9v6pw1zy.cloudfront.net/

Internal details at https://liflig.atlassian.net/l/cp/rhke7t35

## Running locally

```bash
npm ci
npm run build

# Using existing data.
cd packages/repo-collector
aws-vault exec liflig-incubator-admin -- ./fetch-s3-data.sh

# Serve data locally.
# (Keep it running in separate session.)
cd packages/repo-collector
npm run serve

# Run the webapp. Will be available at http://localhost:3000
cd packages/webapp
npm start
```

To collect and aggregate data when doing changes:

```bash
# Collect snapshot. See section about keys.
cd packages/repo-collector
npm run collect-locally

# Aggregate snapshots into webapp format.
cd packages/repo-collector
npm run aggregate-locally
```

## Tips for local development

- Open each package in a separate VS Code window for it to
  identify the expected packages.

## Keys setup

[cals-cli](https://github.com/capralifecycle/cals-cli) is used to do the remote calls
and also controls how keys are set up.

Keys must be set for:

- GitHub
- Snyk

## Deployment

This repo is built and deployed automatically on pushes to master.

## Tech overview

- npm workspaces for multi-package setup
- TypeScript
- Esbuild for bundling of Lambda functions
- Vite for bundling of webapp
- ESLint and Prettier
- CDK for infrastructure
- AWS Lambda

## Manually updating repo-metrics

Two lambdas have to be invoked to run a manual update of repo-metrics:

```bash
# collect
aws lambda invoke --function-name incub-repo-metrics-main-Collector9EBA7CF5-1PVWAMAFCF1ZJ --log-type Tail outfile-collector.json

# aggregate
aws lambda invoke --function-name incub-repo-metrics-main-Aggregator84F1B3DF-17LMXCOQOEV3X --log-type Tail outfile-aggregator.json
```

## Contributing

This project accepts contributions. To get started, please contact the maintainers at [Slack](https://liflig.slack.com/archives/C02T4KTPYS2).

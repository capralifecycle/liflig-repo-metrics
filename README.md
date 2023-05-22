# repo-metrics

https://d2799m9v6pw1zy.cloudfront.net/

Internal details at https://confluence.capraconsulting.no/x/7_IBC

## Running locally

(This setup uses Yarn Workspaces instead of NPM. `npm install -g yarn` if needed.)

```bash
yarn
yarn build

# Using existing data.
cd packages/repo-collector
aws-vault exec liflig-incubator-admin -- ./fetch-s3-data.sh

# Serve data locally.
# (Keep it running in separate session.)
cd packages/repo-collector
yarn serve

# Run the webapp. Will be available at http://localhost:3000
cd packages/webapp
yarn start
```

To collect and aggregate data when doing changes:

```bash
# Collect snapshot. See section about keys.
cd packages/repo-collector
yarn collect-locally

# Aggregate snapshots into webapp format.
cd packages/repo-collector
yarn aggregate-locally
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

- Lerna and Yarn Workspaces for multi-package setup
- TypeScript
- Esbuild for bundling of Lambda functions
- Webpack for bundling of webapp
- ESLint and Prettier
- CDK for infrastructure
- AWS Lambda

## Manually updating repo-metrics

Two lambdas have to be invoked to run a manual update of repo-metrics:

`aws lambda invoke --function-name incub-repo-metrics-main-Collector9EBA7CF5-1PVWAMAFCF1ZJ --log-type Tail outfile-collector.json`

`aws lambda invoke --function-name incub-repo-metrics-main-Aggregator84F1B3DF-17LMXCOQOEV3X --log-type Tail outfile-aggregator.json`

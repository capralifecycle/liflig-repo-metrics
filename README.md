# repo-metrics

See https://confluence.capraconsulting.no/x/7_IBC

## Running locally

(This setup uses Yarn Workspaces instead of NPM. `npm install -g yarn` if needed.)

```bash
yarn
yarn build
```

Generate metrics (also see section about keys):

```bash
cd packages/repo-collector
yarn collect-locally
```

Serve the metrics locally so the webapp can reach it:

```bash
cd packages/repo-collector
yarn convert-locally
yarn serve
```

Serve webapp:

```bash
cd packages/webapp
yarn start
```

http://localhost:3000

## Tips for local development

- Open each package in a separate VS Code window for it to
  identify the expected packages.

## Keys setup

[cals-cli](https://github.com/capralifecycle/cals-cli) is used to do the remote calls
and also controls how keys are set up.

Keys must be set for:

- GitHub
- Snyk

## Manual deployment

Currently deployment is performed manually:

```bash
yarn build
cd packages/infrastructure
aws-vault exec liflig-incubator-admin
yarn cdk deploy --all
```

## Tech overview

- Lerna and Yarn Workspaces for multi-package setup
- TypeScript
- Webpack for bundling
- ESLint and Prettier
- CDK for infrastructure

## To do

- Initial working lambda for collecting metrics
  - Fetch latest resources-definition if not available
  - Manual provisioned secrets for GitHub and Snyk
  - Store data on S3
  - Convert to webapp-specific build
- Visualize data in webapp

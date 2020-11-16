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
npx ts-node metrics.ts
```

Serve the metrics locally so the webapp can reach it:

```bash
cd packages/repo-collector
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

## Tech overview

- Lerna for multi-package setup
- TypeScript
- Webpack for bundling
- ESLint and Prettier

## To do

- Use NPM Workspaces from npm@v7? See https://github.com/npm/rfcs/blob/latest/implemented/0026-workspaces.md
- Fetch latest resources-definition if not available
- Store data on S3
- Retrieve data by URL in webapp
- Bundle repo-collector to be lambda-friendly (webpack?)
- CDK setup
  - Lambda for collector
  - Manual provisioned secrets for GitHub and Snyk
  - Daily scheduling of Lambda
  - S3 for data files
  - S3 for webapp
  - CloudFront for webapp
  - Deploy of webapp
  - Auth with https://github.com/henrist/cdk-cloudfront-auth - similar as
    for git-visualized-activity
- Visualize data in webapp
- Generate an additional webapp-friendly (minimal) dataset? But keep the "raw" collected data
  so we can modify the transformation later based on persisted data.

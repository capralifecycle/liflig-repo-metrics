import { extractDependencyUpdatesFromIssue } from "./renovate"

const example = `This issue contains a list of Renovate updates and their statuses.

## Awaiting Schedule

These updates are awaiting their schedule. Click on a checkbox to ignore the schedule.
 - [ ] <!-- unschedule-branch=renovate/aws-sdk-2.x -->chore(deps): update dependency aws-sdk to v2.797.0
 - [ ] <!-- unschedule-branch=renovate/lock-file-maintenance -->chore(deps): lock file maintenance

## Pending Status Checks

These updates await pending status checks. To force their creation now, check the box below.

 - [ ] <!-- approvePr-branch=renovate/node-13.x -->chore(deps): update dependency @types/node to v13.13.32
 - [ ] <!-- approvePr-branch=renovate/eslint-7.x -->chore(deps): update dependency eslint to v7.14.0
 - [ ] <!-- approvePr-branch=renovate/prettier-2.x -->chore(deps): update dependency prettier to v2.2.0
 - [ ] <!-- approvePr-branch=renovate/typescript-4.x -->chore(deps): update dependency typescript to v4.1.2

## Open

These updates have all been created already. Click a checkbox below to force a retry/rebase of any.

 - [ ] <!-- rebase-branch=renovate/aws-cdk-monorepo -->[chore(deps): update aws-cdk monorepo to v1.74.0](../pull/26) (\`@aws-cdk/assert\`, \`@aws-cdk/aws-certificatemanager\`, \`@aws-cdk/aws-cloudtrail\`, \`@aws-cdk/aws-cloudwatch\`, \`@aws-cdk/aws-cloudwatch-actions\`, \`@aws-cdk/aws-codebuild\`, \`@aws-cdk/aws-ecr\`, \`@aws-cdk/aws-ecs\`, \`@aws-cdk/aws-elasticloadbalancingv2\`, \`@aws-cdk/aws-lambda\`, \`@aws-cdk/aws-rds\`, \`@aws-cdk/aws-route53\`, \`@aws-cdk/aws-route53-targets\`, \`@aws-cdk/aws-s3\`, \`@aws-cdk/aws-sqs\`, \`@aws-cdk/core\`, \`aws-cdk\`)

---

- [ ] <!-- manual job -->Check this box to trigger a request for Renovate to run again on this repository
`

test("extract dependencies from issue body", () => {
  expect(extractDependencyUpdatesFromIssue(example)).toMatchInlineSnapshot(`
    Array [
      Object {
        "name": "Awaiting Schedule",
        "updates": Array [
          Object {
            "name": "aws-sdk",
            "toVersion": "v2.797.0",
          },
        ],
      },
      Object {
        "name": "Pending Status Checks",
        "updates": Array [
          Object {
            "name": "@types/node",
            "toVersion": "v13.13.32",
          },
          Object {
            "name": "eslint",
            "toVersion": "v7.14.0",
          },
          Object {
            "name": "prettier",
            "toVersion": "v2.2.0",
          },
          Object {
            "name": "typescript",
            "toVersion": "v4.1.2",
          },
        ],
      },
      Object {
        "name": "Open",
        "updates": Array [
          Object {
            "name": "aws-cdk monorepo",
            "toVersion": "v1.74.0",
          },
        ],
      },
    ]
  `)
})

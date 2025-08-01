import * as webappDeploy from "@capraconsulting/webapp-deploy-lambda"
import type { AuthLambdas } from "@liflig/cdk-cloudfront-auth"
import { CloudFrontAuth } from "@liflig/cdk-cloudfront-auth"
import * as cdk from "aws-cdk-lib"
import { Duration } from "aws-cdk-lib"
import * as cloudfront from "aws-cdk-lib/aws-cloudfront"
import * as origins from "aws-cdk-lib/aws-cloudfront-origins"
import * as cw from "aws-cdk-lib/aws-cloudwatch"
import { UserPool, UserPoolIdentityProvider } from "aws-cdk-lib/aws-cognito"
import * as events from "aws-cdk-lib/aws-events"
import * as eventstargets from "aws-cdk-lib/aws-events-targets"
import * as iam from "aws-cdk-lib/aws-iam"
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as s3 from "aws-cdk-lib/aws-s3"
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager"
import * as stepfunctions from "aws-cdk-lib/aws-stepfunctions"
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks"
import type * as constructs from "constructs"
import { CorePlatformConsumer } from "./core-platform"

interface Props extends cdk.StackProps {
  authDomain: string
  authLambdas: AuthLambdas
  userPoolId: string
  reporterSlackWebhookUrlSecretName: string
}

export class RepoMetricsStack extends cdk.Stack {
  constructor(scope: constructs.Construct, id: string, props: Props) {
    super(scope, id, props)

    const corePlatform = new CorePlatformConsumer(this, "CorePlatform")

    const userPool = UserPool.fromUserPoolId(this, "UserPool", props.userPoolId)
    userPool.registerIdentityProvider(
      UserPoolIdentityProvider.fromProviderName(
        this,
        "GoogleProvider",
        "Google",
      ),
    )

    const reporterSlackWebhookUrlSecret =
      secretsmanager.Secret.fromSecretNameV2(
        this,
        "ReporterSlackWebhookUrlSecret",
        props.reporterSlackWebhookUrlSecretName,
      )

    const dataBucket = new s3.Bucket(this, "DataBucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
    })

    const webappBucket = new s3.Bucket(this, "WebappBucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
    })

    const webappDataBucket = new s3.Bucket(this, "WebappDataBucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
    })

    const auth = new CloudFrontAuth(this, "CloudFrontAuth", {
      cognitoAuthDomain: props.authDomain,
      authLambdas: props.authLambdas,
      userPool,
      requireGroupAnyOf: ["liflig-active"],
    })

    const webappOrigin = origins.S3BucketOrigin.withOriginAccessIdentity(
      webappBucket,
      {
        originPath: "/web",
      },
    )

    const webappDataOrigin =
      origins.S3BucketOrigin.withOriginAccessIdentity(webappDataBucket)

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: auth.createProtectedBehavior(webappOrigin),
      defaultRootObject: "index.html",
      additionalBehaviors: {
        ...auth.createAuthPagesBehaviors(webappOrigin),
        "/data/*": auth.createProtectedBehavior(webappDataOrigin),
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    })

    auth.updateClient("ClientUpdate", {
      signOutUrl: `https://${distribution.distributionDomainName}${auth.signOutRedirectTo}`,
      callbackUrl: `https://${distribution.distributionDomainName}${auth.callbackPath}`,
      identityProviders: ["Google"],
    })

    new webappDeploy.WebappDeploy(this, "WebappDeploy", {
      source: webappDeploy.Source.asset("../webapp/build"),
      webBucket: webappBucket,
      distribution,
    })

    const githubTokenSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "GithubTokenSecret",
      "/incub/repo-metrics/github-token",
    )

    const snykTokenSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "SnykTokenSecret",
      "/incub/repo-metrics/snyk-token",
    )

    const sonarCloudTokenSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "SonarCloudTokenSecret",
      "/incub/repo-metrics/sonarcloud-token",
    )

    const collectorFn = new lambda.Function(this, "Collector", {
      code: lambda.Code.fromAsset("../repo-collector/dist"),
      handler: "index.collectHandler",
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      environment: {
        GITHUB_TOKEN_SECRET_ID: githubTokenSecret.secretArn,
        SNYK_TOKEN_SECRET_ID: snykTokenSecret.secretArn,
        SONARCLOUD_TOKEN_SECRET_ID: sonarCloudTokenSecret.secretArn,
        DATA_BUCKET_NAME: dataBucket.bucketName,
        // Make cals-cli "cache" work.
        XDG_CACHE_HOME: "/tmp",
      },
    })

    githubTokenSecret.grantRead(collectorFn)
    snykTokenSecret.grantRead(collectorFn)
    sonarCloudTokenSecret.grantRead(collectorFn)
    dataBucket.grantReadWrite(collectorFn)

    const aggregatorMemoryMB = 300
    const aggregatorFn = new lambda.Function(this, "Aggregator", {
      code: lambda.Code.fromAsset("../repo-collector/dist"),
      handler: "index.aggregateHandler",
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: cdk.Duration.minutes(5),
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_229_0,
      memorySize: aggregatorMemoryMB,
      environment: {
        DATA_BUCKET_NAME: dataBucket.bucketName,
        WEBAPP_DATA_BUCKET_NAME: webappDataBucket.bucketName,
        CF_DISTRIBUTION_ID: distribution.distributionId,
      },
      initialPolicy: [
        new iam.PolicyStatement({
          actions: ["cloudfront:CreateInvalidation"],
          resources: ["*"], // Cannot be restricted.
        }),
      ],
    })

    dataBucket.grantReadWrite(aggregatorFn)
    webappDataBucket.grantReadWrite(aggregatorFn)

    const reporterFn = new lambda.Function(this, "Reporter", {
      code: lambda.Code.fromAsset("../repo-collector/dist"),
      handler: "index.reportHandler",
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        DATA_BUCKET_NAME: dataBucket.bucketName,
        // We consider it to be OK to leave this as a plain env.
        SLACK_WEBHOOK_URL: reporterSlackWebhookUrlSecret
          .secretValueFromJson("url")
          .toString(),
        // Used to update the lambda configuration when the secret value is updated
        // in Secrets Manager
        SERIAL: "0",
      },
    })

    dataBucket.grantReadWrite(reporterFn)

    new events.Rule(this, "RepoMetricsReporterSchedule", {
      // Every day at 8am (9am summer) in Oslo time
      // The function itself has logic to skip execution on non-working days.
      schedule: events.Schedule.cron({
        hour: "7",
        minute: "0",
      }),
      targets: [new eventstargets.LambdaFunction(reporterFn)],
      enabled: true,
    })

    this.addAlarmIfNotSuccessWithin("ReporterNotSuccessAlarm", {
      fn: reporterFn,
      // Note: Metrics cannot be checked across more than a day
      duration: cdk.Duration.days(1),
      alarmAction: corePlatform.slackWarningsAction,
    })

    const collectorJob = new tasks.LambdaInvoke(this, "CollectorJob", {
      lambdaFunction: collectorFn,
    })

    const aggregatorJob = new tasks.LambdaInvoke(this, "AggregateJob", {
      lambdaFunction: aggregatorFn,
    })

    const stateMachineDefinition = collectorJob.next(aggregatorJob)

    const stateMachine = new stepfunctions.StateMachine(this, "StateMachine", {
      definition: stateMachineDefinition,
      timeout: cdk.Duration.minutes(10),
    })

    const executionSuccessesLast12Hours = stateMachine.metricSucceeded({
      statistic: cw.Stats.SUM,
      period: Duration.hours(12),
      label: "Repo metrics state machine successes last 12 hours",
    })

    const alarm = new cw.Alarm(this, "StateMachineExecutionFailureAlarm", {
      alarmDescription:
        "Enter alarm state when state machine has not succeeded in the last 12 hours.",
      comparisonOperator: cw.ComparisonOperator.LESS_THAN_THRESHOLD,
      threshold: 1,
      evaluationPeriods: 1,
      metric: executionSuccessesLast12Hours,
    })

    alarm.addAlarmAction(corePlatform.slackWarningsAction)
    alarm.addOkAction(corePlatform.slackWarningsAction)

    // State machine schedule
    new events.Rule(this, "RepoMetricsSchedule", {
      schedule: events.Schedule.cron({
        hour: "0/6",
        minute: "0",
      }),
      targets: [new eventstargets.SfnStateMachine(stateMachine)],
      enabled: true,
    })

    new cdk.CfnOutput(this, "DataBucketNameOutput", {
      value: dataBucket.bucketName,
    })

    new cdk.CfnOutput(this, "WebappDataBucketNameOutput", {
      value: webappDataBucket.bucketName,
    })

    new cdk.CfnOutput(this, "WebappUrlOutput", {
      value: `https://${distribution.distributionDomainName}`,
    })

    new cdk.CfnOutput(this, "DistributionIdOutput", {
      value: distribution.distributionId,
    })

    new cdk.CfnOutput(this, "ReporterFunctionArnOutput", {
      value: reporterFn.functionArn,
    })
  }
  private addAlarmIfNotSuccessWithin(
    id: string,
    props: {
      fn: lambda.Function
      duration: cdk.Duration
      alarmAction: cw.IAlarmAction
    },
  ) {
    const alarm = new cw.MathExpression({
      expression: "invocations - errors",
      usingMetrics: {
        invocations: props.fn.metricInvocations(),
        errors: props.fn.metricErrors(),
      },
      period: props.duration,
    }).createAlarm(this, id, {
      alarmDescription: `Function ${
        props.fn.functionName
      } has not run successful for the last ${props.duration.toHumanString()}`,
      evaluationPeriods: 1,
      threshold: 0,
      treatMissingData: cw.TreatMissingData.BREACHING,
      comparisonOperator: cw.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
    })
    alarm.addAlarmAction(props.alarmAction)
    alarm.addOkAction(props.alarmAction)
  }
}

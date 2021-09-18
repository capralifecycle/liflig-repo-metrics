import * as cloudfront from "@aws-cdk/aws-cloudfront"
import * as origins from "@aws-cdk/aws-cloudfront-origins"
import * as cw from "@aws-cdk/aws-cloudwatch"
import { UserPool, UserPoolIdentityProvider } from "@aws-cdk/aws-cognito"
import * as events from "@aws-cdk/aws-events"
import * as eventstargets from "@aws-cdk/aws-events-targets"
import * as iam from "@aws-cdk/aws-iam"
import * as lambda from "@aws-cdk/aws-lambda"
import * as s3 from "@aws-cdk/aws-s3"
import * as secretsmanager from "@aws-cdk/aws-secretsmanager"
import * as cdk from "@aws-cdk/core"
import * as webappDeploy from "@capraconsulting/webapp-deploy-lambda"
import { AuthLambdas, CloudFrontAuth } from "@henrist/cdk-cloudfront-auth"
import { CorePlatformConsumer } from "./core-platform"

interface Props extends cdk.StackProps {
  authDomain: string
  authLambdas: AuthLambdas
  userPoolId: string
  reporterSlackWebhookUrlSecretName: string
}

export class RepoMetricsStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: Props) {
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

    const auth = new CloudFrontAuth(this, "Auth", {
      cognitoAuthDomain: props.authDomain,
      authLambdas: props.authLambdas,
      userPool,
      requireGroupAnyOf: ["liflig-active"],
    })

    const webappOrigin = new origins.S3Origin(webappBucket, {
      originPath: "/web",
    })
    const webappDataOrigin = new origins.S3Origin(webappDataBucket)

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: auth.createProtectedBehavior(webappOrigin),
      defaultRootObject: "index.html",
      // Custom domain later?
      // certificate: props.cloudfrontCertificate,
      // domainNames: [props.domainName],
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

    const collector = new lambda.Function(this, "Collector", {
      code: lambda.Code.fromAsset("../repo-collector/dist"),
      handler: "index.collectHandler",
      runtime: lambda.Runtime.NODEJS_12_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      environment: {
        GITHUB_TOKEN_SECRET_ID: githubTokenSecret.secretArn,
        SNYK_TOKEN_SECRET_ID: snykTokenSecret.secretArn,
        DATA_BUCKET_NAME: dataBucket.bucketName,
        // Make cals-cli "cache" work.
        XDG_CACHE_HOME: "/tmp",
      },
    })

    githubTokenSecret.grantRead(collector)
    snykTokenSecret.grantRead(collector)
    dataBucket.grantReadWrite(collector)

    new events.Rule(this, "CollectorSchedule", {
      schedule: events.Schedule.cron({
        hour: "0/6",
        minute: "0",
      }),
      targets: [new eventstargets.LambdaFunction(collector)],
      enabled: true,
    })

    this.addAlarmIfNotSuccessWithin("CollectorNotSuccessAlarm", {
      fn: collector,
      duration: cdk.Duration.hours(12),
      alarmAction: corePlatform.slackAlarmAction,
    })

    const aggregator = new lambda.Function(this, "Aggregator", {
      code: lambda.Code.fromAsset("../repo-collector/dist"),
      handler: "index.aggregateHandler",
      runtime: lambda.Runtime.NODEJS_12_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
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

    dataBucket.grantReadWrite(aggregator)
    webappDataBucket.grantReadWrite(aggregator)

    new events.Rule(this, "AggregatorSchedule", {
      schedule: events.Schedule.cron({
        hour: "0/6",
        minute: "10",
      }),
      targets: [new eventstargets.LambdaFunction(aggregator)],
      enabled: true,
    })

    this.addAlarmIfNotSuccessWithin("AggregatorNotSuccessAlarm", {
      fn: aggregator,
      duration: cdk.Duration.hours(12),
      alarmAction: corePlatform.slackAlarmAction,
    })

    const reporter = new lambda.Function(this, "Reporter", {
      code: lambda.Code.fromAsset("../repo-collector/dist"),
      handler: "index.reportHandler",
      runtime: lambda.Runtime.NODEJS_12_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        DATA_BUCKET_NAME: dataBucket.bucketName,
        // We consider it to be OK to leave this as a plain env.
        SLACK_WEBHOOK_URL: reporterSlackWebhookUrlSecret
          .secretValueFromJson("url")
          .toString(),
      },
    })

    dataBucket.grantReadWrite(reporter)

    new events.Rule(this, "ReporterSchedule", {
      // Note: The function itself also has some logic to skip running
      // non-working days.
      schedule: events.Schedule.cron({
        // For Oslo-time: Will trigger 8 am normal time and 9 am summer time.
        // This should be after the collector has run.
        hour: "7",
        minute: "0",
      }),
      targets: [new eventstargets.LambdaFunction(reporter)],
      enabled: true,
    })

    this.addAlarmIfNotSuccessWithin("ReporterNotSuccessAlarm", {
      fn: reporter,
      // Note: Metrics cannot be checked across more than a day
      duration: cdk.Duration.days(1),
      alarmAction: corePlatform.slackAlarmAction,
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
      value: reporter.functionArn,
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

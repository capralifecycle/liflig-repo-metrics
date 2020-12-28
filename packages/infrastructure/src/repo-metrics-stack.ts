import * as cloudfront from "@aws-cdk/aws-cloudfront"
import * as origins from "@aws-cdk/aws-cloudfront-origins"
import { UserPool, UserPoolIdentityProvider } from "@aws-cdk/aws-cognito"
import * as events from "@aws-cdk/aws-events"
import * as eventstargets from "@aws-cdk/aws-events-targets"
import * as iam from "@aws-cdk/aws-iam"
import * as lambda from "@aws-cdk/aws-lambda"
import * as s3 from "@aws-cdk/aws-s3"
import * as s3deploy from "@aws-cdk/aws-s3-deployment"
import * as secretsmanager from "@aws-cdk/aws-secretsmanager"
import * as cdk from "@aws-cdk/core"
import { AuthLambdas, CloudFrontAuth } from "@henrist/cdk-cloudfront-auth"

interface Props extends cdk.StackProps {
  authDomain: string
  authLambdas: AuthLambdas
  userPoolId: string
}

export class RepoMetricsStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: Props) {
    super(scope, id, props)

    const userPool = UserPool.fromUserPoolId(this, "UserPool", props.userPoolId)
    userPool.registerIdentityProvider(
      UserPoolIdentityProvider.fromProviderName(
        this,
        "GoogleProvider",
        "Google",
      ),
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

    const webappOrigin = new origins.S3Origin(webappBucket)
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

    new s3deploy.BucketDeployment(this, "DeployWebapp", {
      sources: [s3deploy.Source.asset("../webapp/build")],
      destinationBucket: webappBucket,
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

    const aggregator = new lambda.Function(this, "Aggregator", {
      code: lambda.Code.fromAsset("../repo-collector/dist"),
      handler: "index.aggregateHandler",
      runtime: lambda.Runtime.NODEJS_12_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
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
  }
}

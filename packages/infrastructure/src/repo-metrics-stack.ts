import * as cloudfront from "@aws-cdk/aws-cloudfront"
import * as origins from "@aws-cdk/aws-cloudfront-origins"
import { UserPool, UserPoolIdentityProvider } from "@aws-cdk/aws-cognito"
import * as events from "@aws-cdk/aws-events"
import * as eventstargets from "@aws-cdk/aws-events-targets"
import * as lambda from "@aws-cdk/aws-lambda"
import * as s3 from "@aws-cdk/aws-s3"
import * as s3deploy from "@aws-cdk/aws-s3-deployment"
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

    const webappBucket = new s3.Bucket(this, "WebappBucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
    })

    new s3deploy.BucketDeployment(this, "DeployWebapp", {
      sources: [s3deploy.Source.asset("../webapp/build")],
      destinationBucket: webappBucket,
    })

    const dataBucket = new s3.Bucket(this, "DataBucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
    })

    const auth = new CloudFrontAuth(this, "Auth", {
      cognitoAuthDomain: props.authDomain,
      authLambdas: props.authLambdas,
      userPool,
      requireGroupAnyOf: ["liflig-active"],
    })

    const webOrigin = new origins.S3Origin(webappBucket)
    const dataOrigin = new origins.S3Origin(dataBucket)

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: auth.createProtectedBehavior(webOrigin),
      defaultRootObject: "index.html",
      // Custom domain later?
      // certificate: props.cloudfrontCertificate,
      // domainNames: [props.domainName],
      additionalBehaviors: {
        ...auth.createAuthPagesBehaviors(webOrigin),
        "/data/*": auth.createProtectedBehavior(dataOrigin),
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    })

    auth.updateClient("ClientUpdate", {
      signOutUrl: `https://${distribution.distributionDomainName}${auth.signOutRedirectTo}`,
      callbackUrl: `https://${distribution.distributionDomainName}${auth.callbackPath}`,
    })

    const collector = new lambda.Function(this, "Collector", {
      // TODO: Use bulid from repo-collector.
      code: lambda.Code.fromInline("console.log('I ran!');"),
      handler: "index.js",
      runtime: lambda.Runtime.NODEJS_12_X,
      timeout: cdk.Duration.minutes(5),
    })

    new events.Rule(this, "CollectorSchedule", {
      schedule: events.Schedule.cron({
        hour: "4",
        minute: "0",
      }),
      targets: [new eventstargets.LambdaFunction(collector)],
    })

    new cdk.CfnOutput(this, "WebappUrlOutput", {
      value: `https://${distribution.distributionDomainName}`,
    })
  }
}

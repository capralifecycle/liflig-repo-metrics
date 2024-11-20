import type * as constructs from "constructs"
import * as cdk from "aws-cdk-lib"
import { AuthLambdas } from "@liflig/cdk-cloudfront-auth"

/**
 * Stack deployed in us-east-1 to hold "Lambda@edge" resource.
 */
export class RepoMetricsEdgeStack extends cdk.Stack {
  public readonly authLambdas: AuthLambdas

  constructor(scope: constructs.Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props)

    this.authLambdas = new AuthLambdas(this, "AuthLambdas", {
      regions: ["eu-west-1"],
      nonce: "2",
    })
  }
}

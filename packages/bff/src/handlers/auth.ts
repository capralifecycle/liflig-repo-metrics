/* eslint-disable @typescript-eslint/require-await */
import {
  APIGatewayAuthorizerResult,
  APIGatewayTokenAuthorizerHandler,
} from "aws-lambda"

export const handler: APIGatewayTokenAuthorizerHandler = async (event) => {
  console.log("event")
  console.log(event)

  const token = event.authorizationToken
  switch (token) {
    case "allow":
      const result = generatePolicy("user", "Allow", event.methodArn)
      console.log(JSON.stringify(result))
      return result
    case "deny":
      return generatePolicy("user", "Deny", event.methodArn)
    case "unauthorized":
      throw new Error("Unauthorized")
    default:
      throw new Error("Error: Invalid token")
  }
}

function generatePolicy(
  principalId: string,
  effect: string,
  resource: string,
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: resource,
        },
      ],
    },
  }
}

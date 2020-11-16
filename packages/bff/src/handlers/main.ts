/* eslint-disable @typescript-eslint/require-await */
import { APIGatewayProxyWithLambdaAuthorizerHandler } from "aws-lambda"

/*
export const handler: APIGatewayProxyHandler = (event, context, callback) => {
  callback(null, {
    statusCode: 200,
    body: "Hello world",
  })
}
*/

export const handler: APIGatewayProxyWithLambdaAuthorizerHandler<any> = async (
  event,
  context,
) => {
  console.log("event", JSON.stringify(event))
  console.log("context", JSON.stringify(context))

  return {
    statusCode: 200,
    body: "Hello world",
  }
}

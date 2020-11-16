import { Handler } from "aws-lambda"
import { main } from "./metrics"

export const handler: Handler = async () => {
  await main()
}

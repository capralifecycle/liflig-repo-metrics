import {
  formatReportData,
  generateMessage,
  sendSlackMessage,
} from "./reporter/reporter"
import { LocalSnapshotsRepository } from "./snapshots/snapshots-repository"

async function main() {
  const snapshotsRepository = new LocalSnapshotsRepository()

  const snapshotData = await snapshotsRepository.get()
  const details = await formatReportData(snapshotData)

  if (details == null) {
    console.log("No data found to generate details")
    return
  }

  const message = generateMessage(details)

  console.log(message)

  const slackWebhookUrl = process.env["SLACK_WEBHOOK_URL"]
  if (slackWebhookUrl) {
    console.log("Got Slack webhook URL - will send")
    await sendSlackMessage(slackWebhookUrl, message)
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || error)
  process.exitCode = 1
})

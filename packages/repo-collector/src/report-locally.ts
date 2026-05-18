import { Temporal } from "@js-temporal/polyfill"
import {
  buildPerTeamMessages,
  buildReportData,
  sendSlackMessages,
} from "./reporter/reporter"
import { LocalSnapshotsRepository } from "./snapshots/snapshots-repository"

async function main() {
  const snapshotsRepository = new LocalSnapshotsRepository()
  const webappUrl =
    process.env.WEBAPP_URL ?? "https://d2799m9v6pw1zy.cloudfront.net"

  const snapshotData = await snapshotsRepository.get()
  const reportData = buildReportData(snapshotData, Temporal.Now.instant())
  const messages = buildPerTeamMessages(reportData, webappUrl)

  console.log(
    `Will send ${messages.length} message(s) — one per team with vulnerabilities.`,
  )
  console.log(
    "Paste any single block payload into https://app.slack.com/block-kit-builder/ to preview.",
  )
  console.log(
    "(Builder validates against a blocks-only schema; the top-level `text`",
  )
  console.log(
    " field used for webhook notification fallback is omitted here.)\n",
  )
  for (const [i, message] of messages.entries()) {
    console.log(`# Message ${i + 1}: ${message.text}`)
    console.log(JSON.stringify({ blocks: message.blocks }, null, 2))
    console.log()
  }

  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL
  if (slackWebhookUrl) {
    console.log(`Sending ${messages.length} message(s) to Slack…`)
    await sendSlackMessages(slackWebhookUrl, messages)
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || error)
  process.exitCode = 1
})

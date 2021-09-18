import * as cloudwatchActions from "@aws-cdk/aws-cloudwatch-actions"
import * as sns from "@aws-cdk/aws-sns"
import * as cdk from "@aws-cdk/core"
import { platform } from "@liflig/cdk"

const slackAlarmTopicArnParam = "slack-alarm-topic-arn"

const platformNamespace = "incub"
const platformName = "incubator-common-core"

export class CorePlatformConsumer extends platform.PlatformConsumer {
  constructor(scope: cdk.Construct, id: string) {
    super(scope, id, {
      platformNamespace,
      platformName,
    })
  }

  public get slackAlarmAction(): cloudwatchActions.SnsAction {
    return this._slackAlarmAction()
  }
  private _slackAlarmAction = this.lazy(
    () =>
      new cloudwatchActions.SnsAction(
        sns.Topic.fromTopicArn(
          this,
          "SlackAlarmTopic",
          this.getParam(slackAlarmTopicArnParam),
        ),
      ),
  )
}

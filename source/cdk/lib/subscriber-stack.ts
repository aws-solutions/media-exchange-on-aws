/**
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as kms from "aws-cdk-lib/aws-kms";
import * as sns from "aws-cdk-lib/aws-sns";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as events from "aws-cdk-lib/aws-events";

export class SubscriberStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    /**
     * CloudFormation Template Descrption
     */
    const solutionId = "SO0133";
    const solutionName = "Media Exchange on AWS";
    this.templateOptions.description = `(${solutionId}) - ${solutionName} __VERSION__ - setup a subscriber`;

    /**
     * Cfn Parameters
     */
    const environment = new cdk.CfnParameter(this, "Environment", {
      type: "String",
      description: "Deployment Environment Name",
      allowedPattern: "[A-Za-z0-9]+",
      default: "dev",
      constraintDescription:
        "Malformed input-Parameter Environment must only contain uppercase and lowercase letters and numbers",
      maxLength: 10,
      minLength: 2,
    });
    const subscriberName = new cdk.CfnParameter(this, "SubscriberName", {
      type: "String",
      description: "A name for subscriber account",
      allowedPattern: "[A-Za-z0-9]+",
      constraintDescription:
        "Malformed input-Parameter SubscriberName must only contain uppercase and lowercase letters and numbers",
      maxLength: 64,
      minLength: 3,
    });
    const email = new cdk.CfnParameter(this, "Email", {
      type: "String",
      description: "The email address for the transfer notifications.",
      allowedPattern:
        "^[_A-Za-z0-9-\\+]+(\\.[_A-Za-z0-9-]+)*@[A-Za-z0-9-]+(\\.[A-Za-z0-9]+)*(\\.[A-Za-z]{2,})$",
    });
    const subscriberAccountId = new cdk.CfnParameter(
      this,
      "SubscriberAccountId",
      {
        type: "String",
        description:
          "The AWS accountId of the subscriber. This parameter is ignored if you specify SubscriberRole.",
        allowedPattern: "^\\d{12}$",
        constraintDescription:
          "Malformed input-Parameter SubscriberAccountId must be a 12 digit number",
      }
    );
    const subscriberRole = new cdk.CfnParameter(this, "SubscriberRole", {
      type: "String",
      description:
        "Subscriber's Role. Defaults to arn:aws:iam::$SubscriberAccountId:root.",
      allowedPattern: "[A-Za-z0-9:/-]*",
      default: "",
    });

    /**
     * Conditions
     */
    const hasRole = new cdk.CfnCondition(this, "HasRole", {
      expression: cdk.Fn.conditionNot(
        cdk.Fn.conditionEquals(subscriberRole.valueAsString, "")
      ),
    });

    /**
     * Template metadata
     */
    this.templateOptions.metadata = {
      "AWS::CloudFormation::Interface": {
        ParameterGroups: [
          {
            Label: { default: "Deployment Configuration" },
            Parameters: [environment.logicalId],
          },
          {
            Label: { default: "Subscriber Configuration" },
            Parameters: [
              subscriberName.logicalId,
              subscriberRole.logicalId,
              subscriberAccountId.logicalId,
              email.logicalId,
            ],
          },
        ],
      },
    };

    // KMS
    const kmsPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          sid: "KeyManagement",
          effect: iam.Effect.ALLOW,
          actions: [
            "kms:Create*",
            "kms:Describe*",
            "kms:Enable*",
            "kms:List*",
            "kms:Put*",
            "kms:Update*",
            "kms:Revoke*",
            "kms:Disable*",
            "kms:Get*",
            "kms:Delete*",
            "kms:TagResource",
            "kms:UntagResource",
            "kms:ScheduleKeyDeletion",
            "kms:CancelKeyDeletion",
            "kms:GenerateDataKey*",
            "kms:Decrypt",
          ],
          principals: [
            new iam.ArnPrincipal(
              `arn:${cdk.Aws.PARTITION}:iam::${cdk.Aws.ACCOUNT_ID}:root`
            ),
          ],
          resources: ["*"],
        }),
        new iam.PolicyStatement({
          sid: "Allow access for Key User (SNS Service Principal)",
          effect: iam.Effect.ALLOW,
          actions: ["kms:GenerateDataKey*", "kms:Decrypt"],
          principals: [new iam.ServicePrincipal("sns.amazonaws.com")],
          resources: ["*"],
        }),
        new iam.PolicyStatement({
          sid: "Allow access for Key User (Events Service Principal)",
          effect: iam.Effect.ALLOW,
          actions: ["kms:Decrypt", "kms:GenerateDataKey*"],
          principals: [new iam.ServicePrincipal("events.amazonaws.com")],
          resources: ["*"],
        }),
        new iam.PolicyStatement({
          sid: "Allow access for Key User (x-account permissions for subscriber)",
          effect: iam.Effect.ALLOW,
          actions: ["kms:Decrypt", "kms:GenerateDataKey*"],
          principals: [
            new iam.AccountPrincipal(subscriberAccountId.valueAsString),
          ],
          resources: ["*"],
        }),
      ],
    });

    const cmk = new kms.Key(this, "CMK", {
      description: "Symetric Key for Encrypting Objects in Media Exchange",
      pendingWindow: cdk.Duration.days(7),
      enabled: true,
      enableKeyRotation: true,
      policy: kmsPolicy,
    });

    // SNS Topic for subscribers
    const notificationTopic = new sns.Topic(this, "NotificationTopic", {
      displayName: "SNS Topic for MediaExchange Subscriber Notifications",
      masterKey: cmk,
    });

    notificationTopic.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "Allow_Publish_Events",
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("events.amazonaws.com")],
        actions: ["sns:Publish"],
        resources: [notificationTopic.topicArn],
      })
    );

    notificationTopic.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "Allow_X_Account_Subscribe",
        effect: iam.Effect.ALLOW,
        principals: [
          new iam.AccountPrincipal(subscriberAccountId.valueAsString),
        ],
        actions: ["sns:Subscribe"],
        resources: [notificationTopic.topicArn],
      })
    );

    const dlq = new sqs.Queue(this, "DLQ", {
      encryptionMasterKey: cmk,
      dataKeyReuse: cdk.Duration.seconds(86400),
      retentionPeriod: cdk.Duration.seconds(1209600),
    });

    dlq.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("events.amazonaws.com")],
        actions: ["sqs:SendMessage"],
        resources: [dlq.queueArn],
      })
    );

    new events.CfnEventBusPolicy( // NOSONAR
      this,
      "PutEventsPermission",
      {
        action: "events:PutEvents",
        principal: subscriberAccountId.valueAsString,
        statementId: `Sid${subscriberName.valueAsString}${environment.valueAsString}${cdk.Aws.REGION}Events`,
      }
    );

    // Subscriber role is root role if not specified
    const subscriberRoleOutput = cdk.Fn.conditionIf(
      hasRole.logicalId,
      subscriberRole.valueAsString,
      `arn:${cdk.Aws.PARTITION}:iam::${subscriberAccountId.valueAsString}:root`
    );

    // outputs
    new cdk.CfnOutput(this, "SubscriberNotificationsEmail", { // NOSONAR
      // NOSONAR
      description: "Subscriber's notifications Email Address",
      value: email.valueAsString,
      exportName: `mxc-${cdk.Aws.REGION}-${environment.valueAsString}-subscriber-${subscriberName.valueAsString}-email`,
    });
    new cdk.CfnOutput(this, "SubscriberRoleOut", { // NOSONAR
      // NOSONAR
      description: "Subscriber's S3 Access role",
      value: subscriberRoleOutput.toString(),
      exportName: `mxc-${cdk.Aws.REGION}-${environment.valueAsString}-subscriber-${subscriberName.valueAsString}-role`,
    });
    new cdk.CfnOutput(this, "SubscriberNotificationsTopic", { // NOSONAR
      // NOSONAR
      description: "Subscriber's notifications topic name",
      value: notificationTopic.topicArn,
      exportName: `mxc-${cdk.Aws.REGION}-${environment.valueAsString}-subscriber-${subscriberName.valueAsString}-notificationtopic`,
    });
    new cdk.CfnOutput(this, "SubscriberNotificationsDLQ", { // NOSONAR
      // NOSONAR
      description: "Subscriber's notifications dead letter queue Arn",
      value: dlq.queueArn,
      exportName: `mxc-${cdk.Aws.REGION}-${environment.valueAsString}-subscriber-${subscriberName.valueAsString}-notificationdlq`,
    });
  }
}

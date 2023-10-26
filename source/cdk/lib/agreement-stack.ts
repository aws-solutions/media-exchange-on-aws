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
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as kms from "aws-cdk-lib/aws-kms";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as sns from "aws-cdk-lib/aws-sns";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as events from "aws-cdk-lib/aws-events";
import { RemovalPolicy } from "aws-cdk-lib";

export class AgreementStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    /**
     * CloudFormation Template Descrption
     */
    const solutionId = "SO0133";
    const solutionName = "Media Exchange on AWS";
    this.templateOptions.description = `(${solutionId}) - ${solutionName} - setup publisher and subscriber shared resources for asset exchange. Version: __VERSION__`;
    /**
     * Cfn Parameters
     */
    const environment = new cdk.CfnParameter(this, "Environment", {
      type: "String",
      description: "Deployment Environment Name",
      allowedPattern: "[A-Za-z0-9]+",
      default: "dev",
      constraintDescription:
        "Malformed input-Parameter MyParameter must only contain uppercase and lowercase letters and numbers",
      maxLength: 10,
      minLength: 2,
    });
    const publisherName = new cdk.CfnParameter(this, "PublisherName", {
      type: "String",
      description:
        "The name of the publisher, case sensitive, as registered in this Media Exchange deployment.",
      allowedPattern: "[A-Za-z0-9]+",
      constraintDescription:
        "Malformed input-Parameter PublisherName must only contain uppercase and lowercase letters and numbers",
      maxLength: 64,
      minLength: 3,
    });
    const subscriberName = new cdk.CfnParameter(this, "SubscriberName", {
      type: "String",
      description:
        "The name of the subscriber, case sensitive, as registered in this Media Exchange deployment.",
      allowedPattern: "[A-Za-z0-9-]+",
      constraintDescription:
        "Malformed input-Parameter SubscriberName must only contain uppercase and lowercase letters and numbers",
      maxLength: 64,
      minLength: 3,
    });
    const expirationInDays = new cdk.CfnParameter(this, "ExpirationInDays", {
      type: "Number",
      description:
        "The assets get lifecycle deleted after these many days from the MediaExchange bucket.",
      minValue: 1,
      maxValue: 30,
      default: 5,
    });
    const emailNotifications = new cdk.CfnParameter(
      this,
      "EmailNotifications",
      {
        type: "String",
        description:
          'Select yes to forward all notifications to subscriber\'s email. If "no" (default) the notifications are available via EventBridge and SNS.',
        default: "no",
        allowedValues: ["yes", "no"],
      }
    );

    /**
     * Conditions
     */
    const enableEmailNotifications = new cdk.CfnCondition(
      this,
      "EnableEmailNotifications",
      {
        expression: cdk.Fn.conditionEquals(
          emailNotifications.valueAsString,
          "yes"
        ),
      }
    );

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
            Label: { default: "Agreement Configuration" },
            Parameters: [
              publisherName.logicalId,
              subscriberName.logicalId,
              expirationInDays.logicalId,
              emailNotifications.logicalId,
            ],
          },
        ],
      },
    };

    // Import Iam roles
    const subscriberRole = iam.Role.fromRoleArn(
      this,
      "SubscriberRole",
      cdk.Fn.importValue(
        `mxc-${cdk.Aws.REGION}-${environment.valueAsString}-subscriber-${subscriberName.valueAsString}-role`
      )
    );
    const publisherRole = iam.Role.fromRoleArn(
      this,
      "PublisherRole",
      cdk.Fn.importValue(
        `mxc-${cdk.Aws.REGION}-${environment.valueAsString}-publisher-${publisherName.valueAsString}-role`
      )
    );
    const subscriberEmail = cdk.Fn.importValue(
      `mxc-${cdk.Aws.REGION}-${environment.valueAsString}-subscriber-${subscriberName.valueAsString}-email`
    );

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
          ],
          principals: [
            new iam.ArnPrincipal(
              `arn:${cdk.Aws.PARTITION}:iam::${cdk.Aws.ACCOUNT_ID}:root`
            ),
          ],
          resources: ["*"],
        }),
        new iam.PolicyStatement({
          sid: "SubscriberAccess",
          effect: iam.Effect.ALLOW,
          actions: ["kms:Decrypt", "kms:DescribeKey"],
          principals: [subscriberRole],
          resources: ["*"],
          conditions: {
            StringEquals: {
              "kms:ViaService": `s3.${cdk.Aws.REGION}.amazonaws.com`,
            },
          },
        }),
        new iam.PolicyStatement({
          sid: "PublisherAccess",
          effect: iam.Effect.ALLOW,
          actions: [
            "kms:Encrypt",
            "kms:Decrypt",
            "kms:ReEncrypt*",
            "kms:GenerateDataKey*",
            "kms:DescribeKey",
          ],
          principals: [publisherRole],
          resources: ["*"],
          conditions: {
            StringEquals: {
              "kms:ViaService": `s3.${cdk.Aws.REGION}.amazonaws.com`,
            },
          },
        }),
      ],
    });

    const cmk = new kms.Key(this, "CMK", {
      description: "Symetric Key for Encrypting Objects in Media Exchange",
      pendingWindow: cdk.Duration.days(10), // Default to 30 Days
      enabled: true,
      enableKeyRotation: true,
      policy: kmsPolicy,
    });

    /**
     * Exchange bucket
     */
    const logBucket = s3.Bucket.fromBucketName(
      this,
      "LogBucketName",
      cdk.Fn.importValue(
        `mxc-${cdk.Aws.REGION}-${environment.valueAsString}-publisher-${publisherName.valueAsString}-logs`
      )
    );

    const source = new s3.Bucket(this, "ExchangeBucket", {
      enforceSSL: true,
      eventBridgeEnabled: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      serverAccessLogsBucket: logBucket,
      serverAccessLogsPrefix: `logs/${subscriberName.valueAsString}/`,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true,
      }),
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: cmk,
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: "Expire",
          enabled: true,
          expiration: cdk.Duration.days(expirationInDays.valueAsNumber),
        },
        {
          id: "AutoRemove",
          enabled: true,
          noncurrentVersionExpiration: cdk.Duration.days(
            expirationInDays.valueAsNumber
          ),
        },
        {
          id: "CleanupIncompleteUploads",
          enabled: true,
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(2),
        },
      ],
      versioned: true,
    });
    const cfnSource = source.node.findChild("Resource") as s3.CfnBucket;
    cfnSource.cfnOptions.updateReplacePolicy = cdk.CfnDeletionPolicy.RETAIN;

    source.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "RequireTLSSigv4",
        actions: ["s3:*"],
        effect: iam.Effect.DENY,
        resources: [source.bucketArn, `${source.bucketArn}/*`],
        principals: [new iam.AnyPrincipal()],
        conditions: {
          Bool: {
            "aws:SecureTransport": false,
          },
          StringNotEquals: {
            "s3:signatureversion": "AWS4-HMAC-SHA256",
            "s3:x-amz-content-sha256": "UNSIGNED-PAYLOAD",
          },
        },
      })
    );

    source.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowCopyOpPublisher",
        actions: ["s3:PutObject"],
        effect: iam.Effect.ALLOW,
        resources: [`${source.bucketArn}/*`],
        principals: [publisherRole],
        conditions: {
          StringEqualsIfExists: {
            "s3:x-amz-storage-class": "STANDARD",
            "s3:x-amz-server-side-encryption": "aws:kms",
            "s3:x-amz-server-side-encryption-aws-kms-key-id": cmk.keyArn,
          },
        },
      })
    );

    source.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowPublisher",
        actions: [
          "s3:PutObjectTagging",
          "s3:PutObjectVersionTagging",
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:GetObjectAcl",
          "s3:GetObjectVersionAcl",
          "s3:GetObjectTagging",
          "s3:GetObjectVersionTagging",
          "s3:AbortMultipartUpload",
          "s3:ListMultipartUploadParts",
          "s3:DeleteObject",
          "s3:DeleteObjectTagging",
          "s3:DeleteObjectVersion",
          "s3:DeleteObjectVersionTagging",
        ],
        effect: iam.Effect.ALLOW,
        resources: [`${source.bucketArn}/*`],
        principals: [publisherRole],
      })
    );

    source.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowCopyOpSubscriber",
        actions: [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:GetObjectAcl",
          "s3:GetObjectVersionAcl",
          "s3:GetObjectTagging",
          "s3:GetObjectVersionTagging",
        ],
        effect: iam.Effect.ALLOW,
        resources: [`${source.bucketArn}/*`],
        principals: [subscriberRole],
      })
    );

    source.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowBasicConsole",
        actions: ["s3:Get*", "s3:List*"],
        effect: iam.Effect.ALLOW,
        resources: [`${source.bucketArn}/*`],
        principals: [publisherRole, subscriberRole],
      })
    );

    // Subscriber notify
    const snsSubTopic = sns.Topic.fromTopicArn(
      this,
      "SubscriberNotificationsTopic",
      cdk.Fn.importValue(
        `mxc-${cdk.Aws.REGION}-${environment.valueAsString}-subscriber-${subscriberName.valueAsString}-notificationtopic`
      )
    );
    const snsSubDLQ = sqs.Queue.fromQueueArn(
      this,
      "SubscriberNotificationsDLQ",
      cdk.Fn.importValue(
        `mxc-${cdk.Aws.REGION}-${environment.valueAsString}-subscriber-${subscriberName.valueAsString}-notificationdlq`
      )
    );

    const s3NotifySubscriberRule = new events.Rule(
      this,
      "S3NotifySubscriberRule",
      {
        ruleName: "S3NotifySubscriberRule",
        description: "Notify Content Published",
        eventPattern: {
          source: ["aws.s3"],
          detail: {
            bucket: {
              name: [source.bucketName],
            },
          },
          detailType: ["Object Created", "Object Deleted"],
        },
      }
    );
    s3NotifySubscriberRule.addTarget(
      new targets.SnsTopic(snsSubTopic, {
        deadLetterQueue: snsSubDLQ,
        message: events.RuleTargetInput.fromEventPath("$.detail"),
      })
    );

    const subscription = snsSubTopic.addSubscription(
      new subscriptions.EmailSubscription(subscriberEmail)
    );
    let cfnSnsSubTopic = subscription.node.findChild(
      "Resource"
    ) as sns.CfnSubscription;
    cfnSnsSubTopic.cfnOptions.condition = enableEmailNotifications;

    // Publisher topic
    const snsPubTopic = sns.Topic.fromTopicArn(
      this,
      "PublisherNotificationsTopic",
      cdk.Fn.importValue(
        `mxc-${cdk.Aws.REGION}-${environment.valueAsString}-publisher-${publisherName.valueAsString}-notificationtopic`
      )
    );
    const snsPubDLQ = sqs.Queue.fromQueueArn(
      this,
      "PublisherNotificationsDLQ",
      cdk.Fn.importValue(
        `mxc-${cdk.Aws.REGION}-${environment.valueAsString}-publisher-${publisherName.valueAsString}-notificationdlq`
      )
    );

    // Rules to notify publishers
    const s3NotifyPublisherRule = new events.Rule(
      this,
      "S3NotifyPublisherRule",
      {
        ruleName: "S3NotifyPublisherRule",
        description: "Notify Content Published",
        eventPattern: {
          source: ["aws.s3"],
          detail: {
            bucket: {
              name: [source.bucketName],
            },
          },
          detailType: ["Object Created", "Object Deleted"],
        },
      }
    );
    s3NotifyPublisherRule.addTarget(
      new targets.SnsTopic(snsPubTopic, {
        deadLetterQueue: snsPubDLQ,
        message: events.RuleTargetInput.fromEventPath("$.detail"),
      })
    );

    // Notify subscriber about publisher actions
    const notifySubscriberRule = new events.Rule(this, "NotifySubscriberRule", {
      ruleName: "NotifySubscriberRule",
      description: "Notify Publisher Message",
      eventPattern: {
        source: ["mxc.publisher"],
        detailType: [`bucket=${source.bucketName}`],
      },
    });
    notifySubscriberRule.addTarget(
      new targets.SnsTopic(snsSubTopic, {
        deadLetterQueue: snsSubDLQ,
        message: events.RuleTargetInput.fromEventPath("$.detail"),
      })
    );

    // outputs
    new cdk.CfnOutput(this, "SubscriberOnboardingSummary", { // NOSONAR
      // NOSONAR
      description: "Configuration information for subscriber.",
      value: `PUBLISHER_NAME=${publisherName.valueAsString} SUBSCRIBER_NAME=${subscriberName.valueAsString} AWS_REGION=${cdk.Aws.REGION} MEDIAEXCHANGE_BUCKET_NAME=${source.bucketName}  KMS_KEY_ARN=${cmk.keyArn} SNS_TOPIC_ARN=${snsSubTopic.topicArn} EVENT_BUS_ARN=arn:${cdk.Aws.PARTITION}:events:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:event-bus/default SUBSCRIBER_ROLE=${subscriberRole.roleArn}`,
    });
    new cdk.CfnOutput(this, "ConsoleUrl", { // NOSONAR
      // NOSONAR
      description: "Use this url to directly access the shared bucket.",
      value: `https://s3.console.aws.amazon.com/s3/buckets/${source.bucketName}/?region=${cdk.Aws.REGION}&tab=overview`,
    });
    new cdk.CfnOutput(this, "PublisherOnboardingSummary", { // NOSONAR
      // NOSONAR
      description: "Configuration information for publisher.",
      value: `PUBLISHER_NAME=${publisherName.valueAsString} SUBSCRIBER_NAME=${subscriberName.valueAsString} AWS_REGION=${cdk.Aws.REGION} MEDIAEXCHANGE_BUCKET_NAME=${source.bucketName}  KMS_KEY_ARN=${cmk.keyArn} SNS_TOPIC_ARN=${snsPubTopic.topicArn} EVENT_BUS_ARN=arn:${cdk.Aws.PARTITION}:events:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:event-bus/default LOG_BUCKET_NAME=${logBucket.bucketName} PUBLISHER_ROLE=${publisherRole.roleArn}`,
    });
  }
}

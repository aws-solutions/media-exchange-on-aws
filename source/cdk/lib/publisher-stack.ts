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
import * as sns from "aws-cdk-lib/aws-sns";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as events from "aws-cdk-lib/aws-events";
import { NagSuppressions } from "cdk-nag";
import { ArnPrincipal } from "aws-cdk-lib/aws-iam";
import { RemovalPolicy } from "aws-cdk-lib";

export class PublisherStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    /**
     * CloudFormation Template Descrption
     */
    const solutionId = "SO0133";
    const solutionName = "Media Exchange on AWS";
    this.templateOptions.description = `(${solutionId}) - ${solutionName} __VERSION__ - setup a publisher`;
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
    const publisherName = new cdk.CfnParameter(this, "PublisherName", {
      type: "String",
      description: "The name of the publisher",
      allowedPattern: "[A-Za-z0-9]+",
      constraintDescription:
        "Malformed input-Parameter PublisherName must only contain uppercase and lowercase letters and numbers",
      maxLength: 64,
      minLength: 3,
    });
    const publisherAccountId = new cdk.CfnParameter(
      this,
      "PublisherAccountId",
      {
        type: "String",
        description:
          "The AWS accountId of the publisher. This parameter is ignored if you specify PublisherRole.",
        allowedPattern: "^\\d{12}$",
        constraintDescription:
          "Malformed input-Parameter PublisherAccountId must be a 12 digit number",
      }
    );
    const publisherRole = new cdk.CfnParameter(this, "PublisherRole", {
      type: "String",
      description:
        "Publisher's Role. Defaults to arn:aws:iam::$PublisherAccountId:root.",
      allowedPattern: "[A-Za-z0-9:/-]*",
      default: "",
    });

    /**
     * Conditions
     */
    const hasRole = new cdk.CfnCondition(this, "HasRole", {
      expression: cdk.Fn.conditionNot(
        cdk.Fn.conditionEquals(publisherRole.valueAsString, "")
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
            Label: { default: "Publisher Configuration" },
            Parameters: [
              publisherName.logicalId,
              publisherRole.logicalId,
              publisherAccountId.logicalId,
            ],
          },
        ],
      },
    };

    /**
     * Exchange bucket
     */
    const logBucket = new s3.Bucket(this, "ExchangeLogBucket", {
      enforceSSL: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true,
      }),
      accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.RETAIN,
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
      lifecycleRules: [
        {
          id: "Expire",
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
      versioned: true,
    });
    cdk.Tags.of(logBucket).add("Createdby", "__SOLUTION_NAME__/__VERSION__");
    const cfnSource = logBucket.node.findChild("Resource") as s3.CfnBucket;

    //cfn_nag
    cfnSource.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [
          {
            id: "W35",
            reason:
              "(W35) S3 Bucket should have access logging configured: This is the logging bucket.",
          },
        ],
      },
    };
    //cdk_nag
    NagSuppressions.addResourceSuppressions(logBucket, [
      {
        id: "AwsSolutions-S10",
        reason: "Bucket is private and is not using HTTP",
      },
    ]);

    logBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "RequireTLS",
        actions: ["s3:*"],
        effect: iam.Effect.DENY,
        resources: [logBucket.bucketArn, `${logBucket.bucketArn}/*`],
        principals: [new iam.AnyPrincipal()],
        conditions: {
          Bool: {
            "aws:SecureTransport": false,
          },
        },
      })
    );

    // Initialize roles for bucket, publisher role defaults to root account if no role provided
    const publisherRoleForBucket = cdk.Fn.conditionIf(
      hasRole.logicalId,
      publisherRole.valueAsString,
      `arn:${cdk.Aws.PARTITION}:iam::${publisherAccountId.valueAsString}:root`
    );

    logBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowGetOpPublisher",
        actions: [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:GetObjectAcl",
          "s3:GetObjectVersionAcl",
          "s3:GetObjectTagging",
          "s3:GetObjectVersionTagging",
        ],
        effect: iam.Effect.ALLOW,
        resources: [`${logBucket.bucketArn}/*`],
        principals: [new ArnPrincipal(publisherRoleForBucket.toString())],
      })
    );

    logBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowBasicConsole",
        actions: ["s3:Get*", "s3:List*"],
        effect: iam.Effect.ALLOW,
        resources: [logBucket.bucketArn],
        principals: [new ArnPrincipal(publisherRoleForBucket.toString())],
      })
    );

    new events.CfnEventBusPolicy( // NOSONAR
      this,
      "PutEventsPermission",
      {
        action: "events:PutEvents",
        principal: publisherAccountId.valueAsString,
        statementId: `${cdk.Aws.STACK_NAME}Events`,
      }
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
            new iam.AccountPrincipal(publisherAccountId.valueAsString),
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

    // SNS topic initialization
    const notificationTopic = new sns.Topic(this, "NotificationTopic", {
      displayName: "SNS Topic for MediaExchange Publisher Notifications",
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
          new iam.AccountPrincipal(publisherAccountId.valueAsString),
        ],
        actions: ["sns:Subscribe"],
        resources: [notificationTopic.topicArn],
      })
    );

    const dlq = new sqs.Queue(this, "DLQ", {
      encryption: sqs.QueueEncryption.KMS,
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

    // outputs
    new cdk.CfnOutput(this, "LogBucketName", { // NOSONAR
      // NOSONAR
      description: "Logging Bucket Name",
      value: logBucket.bucketName,
      exportName: `mxc-${cdk.Aws.REGION}-${environment.valueAsString}-publisher-${publisherName.valueAsString}-logs`,
    });
    new cdk.CfnOutput(this, "PublisherRoleOut", { // NOSONAR
      // NOSONAR
      description: "Publisher's S3 Access role",
      value: publisherRoleForBucket.toString(),
      exportName: `mxc-${cdk.Aws.REGION}-${environment.valueAsString}-publisher-${publisherName.valueAsString}-role`,
    });
    new cdk.CfnOutput(this, "PublisherNotificationsTopic", { // NOSONAR
      // NOSONAR
      description: "Publisher's notifications topic name",
      value: notificationTopic.topicArn,
      exportName: `mxc-${cdk.Aws.REGION}-${environment.valueAsString}-publisher-${publisherName.valueAsString}-notificationtopic`,
    });
    new cdk.CfnOutput(this, "PublisherNotificationsDLQ", { // NOSONAR
      // NOSONAR
      description: "Subscriber's notifications dead letter queue Arn",
      value: dlq.queueArn,
      exportName: `mxc-${cdk.Aws.REGION}-${environment.valueAsString}-publisher-${publisherName.valueAsString}-notificationdlq`,
    });
  }
}

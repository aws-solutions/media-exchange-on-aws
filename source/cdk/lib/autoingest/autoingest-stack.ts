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
import * as logs from "aws-cdk-lib/aws-logs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubs from "aws-cdk-lib/aws-sns-subscriptions";
import * as sqs from "aws-cdk-lib/aws-sqs";

export class AutoIngestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    /**
     * CloudFormation Template Descrption
     */
    this.templateOptions.description = `CDK template for AutoIngest.`;

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
    const notificationTopicArn = new cdk.CfnParameter(
      this,
      "NotificationTopicArn",
      {
        type: "String",
        description:
          "MediaExchange Notifications topic from SubscriberOnBoradingSummary",
      }
    );
    const destinationBucket = new cdk.CfnParameter(this, "DestinationBucket", {
      type: "String",
      description: "Destination S3 Bucket Name",
    });
    const mediaExchangeBucket = new cdk.CfnParameter(
      this,
      "MediaExchangeBucket",
      {
        type: "String",
        description: " MediaExchange S3 Bucket Name",
      }
    );
    const destinationPrefix = new cdk.CfnParameter(this, "DestinationPrefix", {
      type: "String",
      description: "Destination prefix for S3 Bucket ingestion",
      default: "ingest",
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
            Label: { default: "Copy Configuration" },
            Parameters: [
              notificationTopicArn.logicalId,
              mediaExchangeBucket.logicalId,
              destinationBucket.logicalId,
              destinationPrefix.logicalId,
            ],
          },
        ],
      },
    };

    /**
     * Mapping for sending anonymized metrics to AWS Solution Builders API
     */
    new cdk.CfnMapping(this, 'AnonymizedData', { // NOSONAR
      mapping: {
          SendAnonymizedData: {
              Data: 'Yes'
          }
      }
    });

    /**
     * Roles and policy for lambda creation
     */
    const driverFunctionRole = new iam.Role(
      this,
      "AWSLambdaBasicExecutionRole",
      {
        assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      }
    );

    const customResourcePolicy = new iam.Policy(this, "CustomResourcePolicy", {
      statements: [
        new iam.PolicyStatement({
          sid: "S3Read",
          resources: [
            `arn:${cdk.Aws.PARTITION}:s3:::${destinationBucket.valueAsString}/*`,
          ],
          actions: [
            "s3:GetObject",
            "s3:PutObject",
            "s3:PutObjectAcl",
            "s3:PutObjectVersionAcl",
            "s3:PutObjectTagging",
            "s3:PutObjectVersionTagging",
            "s3:ListBucket",
          ],
        }),
        new iam.PolicyStatement({
          sid: "S3Write",
          resources: [
            `arn:${cdk.Aws.PARTITION}:s3:::${mediaExchangeBucket.valueAsString}/*`,
          ],
          actions: [
            "s3:GetObject",
            "s3:GetObjectVersion",
            "s3:GetObjectTagging",
            "s3:GetObjectVersionTagging",
            "s3:AbortMultipartUpload",
            "s3:ListMultipartUploadParts",
          ],
        }),
        new iam.PolicyStatement({
          sid: "kms",
          resources: ["*"],
          actions: [
            "kms:Encrypt",
            "kms:Decrypt",
            "kms:ReEncrypt*",
            "kms:GenerateDataKey*",
            "kms:DescribeKey",
          ],
        }),
      ],
    });
    customResourcePolicy.attachToRole(driverFunctionRole);

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
          sid: "Allow access for Key User (SNS Service Principal)",
          effect: iam.Effect.ALLOW,
          actions: ["kms:GenerateDataKey*", "kms:Decrypt"],
          principals: [new iam.ServicePrincipal("sns.amazonaws.com")],
          resources: ["*"],
        }),
        new iam.PolicyStatement({
          sid: "Allow access for Key User (Lambda Function)",
          effect: iam.Effect.ALLOW,
          actions: ["kms:Decrypt"],
          principals: [new iam.ArnPrincipal(driverFunctionRole.roleArn)],
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

    const dlq = new sqs.Queue(this, "DLQ", {
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      retentionPeriod: cdk.Duration.seconds(1209600),
    });

    const nq = new sqs.Queue(this, "NQ", {
      encryption: sqs.QueueEncryption.KMS,
      retentionPeriod: cdk.Duration.seconds(86400),
      encryptionMasterKey: cmk,
      dataKeyReuse: cdk.Duration.seconds(86400),
      visibilityTimeout: cdk.Duration.seconds(900),
    });

    // The Autoingest function
    const driverFunction = new lambda.Function(this, "DriverFunction", {
      runtime: lambda.Runtime.PYTHON_3_8,
      handler: "app.lambda_handler",
      description: "Lambda function to be triggered by SNS notification",
      environment: {
        SOURCE_BUCKET_NAME: mediaExchangeBucket.valueAsString,
        DESTINATION_BUCKET_NAME: destinationBucket.valueAsString,
        DESTINATION_PREFIX: destinationPrefix.valueAsString,
        SOLUTION_IDENTIFIER: "AwsSolution/SO0133/__VERSION__-Autoingest",
        LogLevel: "INFO",
        SendAnonymizedMetric: cdk.Fn.findInMap('AnonymizedData', 'SendAnonymizedData', 'Data')
      },
      functionName: `${cdk.Aws.STACK_NAME}-custom-resource`,
      role: driverFunctionRole,
      code: lambda.Code.fromAsset("lib/autoingest/lambda/autoingest_driver/"),
      timeout: cdk.Duration.seconds(900),
      deadLetterQueue: dlq,
      deadLetterQueueEnabled: true,
    });
    driverFunction.node.addDependency(driverFunctionRole);
    driverFunction.node.addDependency(customResourcePolicy);

    const topic = sns.Topic.fromTopicArn(
      this,
      "MXCEvent",
      notificationTopicArn.valueAsString
    );

    topic.addSubscription(new snsSubs.SqsSubscription(nq));
    const eventSourceSQS = new lambdaEventSources.SqsEventSource(nq);

    driverFunction.addEventSource(eventSourceSQS);

    // Add log group
    new logs.LogGroup( // NOSONAR
      this,
      "driverFunctionLogGroup",
      {
        logGroupName: `/aws/lambda/${driverFunction.functionName}`,
        retention: logs.RetentionDays.ONE_MONTH,
      }
    );
  }
}

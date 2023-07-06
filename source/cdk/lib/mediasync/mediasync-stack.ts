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
import * as logs from "aws-cdk-lib/aws-logs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as batch from "aws-cdk-lib/aws-batch";
import { RemovalPolicy } from "aws-cdk-lib";

export class MediaSyncStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    /**
     * CloudFormation Template Descrption
     */
    this.templateOptions.description = `Cloudformation template for MediaSync.`;

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
    const imageName = new cdk.CfnParameter(this, "ImageName", {
      type: "String",
      description: "Image Name",
      default: "amazon/aws-cli",
    });
    const destinationBucketName = new cdk.CfnParameter(
      this,
      "DestinationBucketName",
      {
        type: "String",
        description: "Destination S3 Bucket Name",
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
            Parameters: [environment.logicalId, imageName.logicalId],
          },
          {
            Label: { default: "Copy Configuration" },
            Parameters: [destinationBucketName.logicalId],
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
     * Create VPC, internet gateway, and subnets
     */
    const vpc = new ec2.Vpc(this, "Vpc", {
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),  // NOSONAR
      enableDnsSupport: true,
      subnetConfiguration: [
        {
          subnetType: ec2.SubnetType.PUBLIC,
          name: "SubnetOne",
          mapPublicIpOnLaunch: true,
          cidrMask: 24,
        },
        {
          subnetType: ec2.SubnetType.PUBLIC,
          name: "SubnetTwo",
          mapPublicIpOnLaunch: true,
          cidrMask: 24,
        },
      ],
    });
    cdk.Tags.of(vpc).add("Name", "mediasync");

    const securityGroup = new ec2.SecurityGroup(this, "SecurityGroup", {
      description:
        "Security Group for the EC2 instances launched into the VPC by Batch",
      vpc,
    });

    new ec2.CfnSecurityGroupIngress( // NOSONAR
      this,
      "SecurityGroupIngress",
      {
        groupId: securityGroup.securityGroupId,
        ipProtocol: "-1",
        sourceSecurityGroupId: securityGroup.securityGroupId,
      }
    );

    /**
     * FlowLogBucket bucket
     */
    const flowLogBucket = new s3.Bucket(this, "FlowLogBucket", {
      enforceSSL: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true,
      }),
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.RETAIN,
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

    flowLogBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "RequireTLS",
        actions: ["s3:*"],
        effect: iam.Effect.DENY,
        resources: [`${flowLogBucket.bucketArn}/*`],
        principals: [new iam.AnyPrincipal()],
        conditions: {
          Bool: {
            "aws:SecureTransport": false,
          },
        },
      })
    );

    flowLogBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AWSLogDeliveryWrite",
        actions: ["s3:PutObject"],
        effect: iam.Effect.ALLOW,
        resources: [
          `arn:aws:s3:::${flowLogBucket.bucketName}/flow-logs/AWSLogs/*`,
        ],
        principals: [new iam.ServicePrincipal("delivery.logs.amazonaws.com")],
        conditions: {
          StringEquals: {
            "s3:x-amz-acl": "bucket-owner-full-control",
          },
        },
      })
    );

    flowLogBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AWSLogDeliveryAclCheck",
        actions: ["s3:GetBucketAcl"],
        effect: iam.Effect.ALLOW,
        resources: [flowLogBucket.bucketArn],
        principals: [new iam.ServicePrincipal("delivery.logs.amazonaws.com")],
      })
    );

    new ec2.FlowLog(this, "VPCLogDeliveringToS3", { // NOSONAR
      resourceType: ec2.FlowLogResourceType.fromVpc(vpc),
      trafficType: ec2.FlowLogTrafficType.ALL,
      destination: ec2.FlowLogDestination.toS3(flowLogBucket),
      maxAggregationInterval: ec2.FlowLogMaxAggregationInterval.ONE_MINUTE,
    });

    // IAM roles for batch
    const batchServiceRole = new iam.Role(this, "BatchServiceRole", {
      description: "Role for batch service.",
      assumedBy: new iam.ServicePrincipal("batch.amazonaws.com"),
    });
    batchServiceRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AWSBatchServiceRole"
      )
    );

    // Create batch compute environments and roles
    const mediaSyncSPOTComputeEnvironment = new batch.CfnComputeEnvironment(
      this,
      "MediaSyncSPOTComputeEnvironment",
      {
        type: "MANAGED",
        serviceRole: batchServiceRole.roleArn,
        computeResources: {
          maxvCpus: 48, // 48x 64 == 3072 < 3500 (number of concurrent PUT requests per prefix.)
          type: "FARGATE_SPOT",
          subnets: vpc.publicSubnets.map((x) => x.subnetId),
          securityGroupIds: [securityGroup.securityGroupId],
        },
      }
    );

    const jobQueue = new batch.CfnJobQueue(this, "MediaSyncJobQueue", {
      priority: 1,
      computeEnvironmentOrder: [
        {
          order: 1,
          computeEnvironment:
            mediaSyncSPOTComputeEnvironment.attrComputeEnvironmentArn,
        },
      ],
    });

    const batchAccessPolicy = new iam.ManagedPolicy(this, "BatchAccessPolicy", {
      statements: [
        new iam.PolicyStatement({
          sid: "batchList",
          effect: iam.Effect.ALLOW,
          actions: ["batch:ListJobs", "batch:TagResource"],
          resources: ["*"],
        }),
        new iam.PolicyStatement({
          sid: "batch",
          effect: iam.Effect.ALLOW,
          actions: [
            "batch:SubmitJob",
            "batch:DescribeJobs",
            "batch:TerminateJob",
          ],
          resources: [
            `arn:aws:batch:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:job-definition/*`,
            `arn:aws:batch:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:job-queue/*`,
          ],
        }),
        new iam.PolicyStatement({
          sid: "kms",
          effect: iam.Effect.ALLOW,
          actions: [
            "kms:Decrypt",
            "kms:Encrypt",
            "kms:ReEncrypt*",
            "kms:GenerateDataKey*",
            "kms:DescribeKey",
          ],
          resources: ["*"],
        }),
        new iam.PolicyStatement({
          sid: "s3",
          effect: iam.Effect.ALLOW,
          actions: [
            "s3:PutObject",
            "s3:PutObjectAcl",
            "s3:PutObjectVersionAcl",
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
            "s3:GetBucketLocation",
          ],
          resources: ["*"],
        }),
      ],
    });

    const customLambdaRole = new iam.Role(this, "customLambdaRole", {
      roleName: "customLambdaRole",
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole"
        ),
      ],
    });
    batchAccessPolicy.attachToRole(customLambdaRole);

    const jobRole = new iam.Role(this, "JobRole", {
      description: "Role for job",
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });
    const jobRolePolicy = new iam.Policy(this, "KMSAndS3", {
      policyName: "KMSAndS3",
      statements: [
        new iam.PolicyStatement({
          resources: ["*"],
          effect: iam.Effect.ALLOW,
          actions: [
            "s3:GetObject",
            "s3:GetObjectVersion",
            "s3:GetObjectAcl",
            "s3:GetObjectVersionAcl",
            "s3:GetObjectTagging",
            "s3:GetObjectVersionTagging",
            "s3:ListBucket",
          ],
        }),
        new iam.PolicyStatement({
          resources: [`arn:aws:s3:::${destinationBucketName.valueAsString}/*`],
          effect: iam.Effect.ALLOW,
          actions: [
            "s3:GetObject",
            "s3:GetObjectVersion",
            "s3:GetObjectAcl",
            "s3:GetObjectVersionAcl",
            "s3:GetObjectTagging",
            "s3:GetObjectVersionTagging",
            "s3:ListBucket",
            "s3:PutObject",
            "s3:PutObjectAcl",
            "s3:PutObjectVersionAcl",
            "s3:AbortMultipartUpload",
            "s3:ListMultipartUploadParts",
            "s3:PutObjectTagging",
            "s3:PutObjectVersionTagging",
          ],
        }),
        new iam.PolicyStatement({
          resources: ["*"],
          effect: iam.Effect.ALLOW,
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
    jobRolePolicy.attachToRole(jobRole);

    const executionRole = new iam.Role(this, "ExecutionRole", {
      description: "Role for execution.",
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });
    executionRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AmazonECSTaskExecutionRolePolicy"
      )
    );

    const s3BatchRole = new iam.Role(this, "MediaSyncS3BatchRole", {
      path: "/",
      description: "Role for s3 batch job",
      assumedBy: new iam.ServicePrincipal("batchoperations.s3.amazonaws.com"),
    });

    const s3BatchRolePolicy = new iam.Policy(this, "S3BatchRolePolicy", {
      policyName: "S3BatchRolePolicy",
      statements: [
        new iam.PolicyStatement({
          resources: ["*"],
          effect: iam.Effect.ALLOW,
          actions: [
            "s3:GetObject",
            "s3:GetObjectVersion",
            "s3:GetObjectAcl",
            "s3:GetObjectVersionAcl",
            "s3:GetObjectTagging",
            "s3:GetObjectVersionTagging",
            "s3:PutObject",
            "lambda:InvokeFunction",
          ],
        }),
        new iam.PolicyStatement({
          resources: ["*"],
          effect: iam.Effect.ALLOW,
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
    s3BatchRolePolicy.attachToRole(s3BatchRole);

    // Two job definitions
    const copyJobDefinitionXRegion = new batch.CfnJobDefinition(
      this,
      "CopyJobDefinitionXRegion",
      {
        type: "container",
        platformCapabilities: ["FARGATE"],
        containerProperties: {
          image: imageName.valueAsString,
          command: [
            "/usr/local/bin/stream.sh",
            "Ref::SourceS3Uri",
            "Ref::DestinationS3Uri",
            "Ref::Size",
            "Ref::SourceBucketRegion",
          ],
          executionRoleArn: executionRole.roleArn,
          jobRoleArn: jobRole.roleArn,
          fargatePlatformConfiguration: {
            platformVersion: "1.4.0",
          },
          networkConfiguration: {
            assignPublicIp: "ENABLED",
          },
          resourceRequirements: [
            {
              type: "VCPU",
              value: "4",
            },
            {
              type: "MEMORY",
              value: "8192",
            },
          ],
        },
        retryStrategy: {
          attempts: 1,
        },
      }
    );

    const copyJobDefinition = new batch.CfnJobDefinition(
      this,
      "CopyJobDefinition",
      {
        type: "container",
        platformCapabilities: ["FARGATE"],
        containerProperties: {
          image: imageName.valueAsString,
          command: [
            "/usr/local/bin/ssc.sh",
            "Ref::SourceS3Uri",
            "Ref::DestinationS3Uri",
            "Ref::Size",
            "Ref::SourceBucketRegion",
          ],
          executionRoleArn: executionRole.roleArn,
          jobRoleArn: jobRole.roleArn,
          fargatePlatformConfiguration: {
            platformVersion: "1.4.0",
          },
          networkConfiguration: {
            assignPublicIp: "ENABLED",
          },
          resourceRequirements: [
            {
              type: "VCPU",
              value: "1",
            },
            {
              type: "MEMORY",
              value: "2048",
            },
          ],
        },
        retryStrategy: {
          attempts: 2,
        },
      }
    );

    // The actual MediaSync function
    const mediaSyncDriverFunction = new lambda.Function(
      this,
      "MediaSyncDriverFunction",
      {
        runtime: lambda.Runtime.PYTHON_3_8,
        handler: "app.lambda_handler",
        description: "Lambda function to be invoked by s3 batch",
        role: customLambdaRole,
        code: lambda.Code.fromAsset("lib/mediasync/lambda/mediasync_driver/"),
        timeout: cdk.Duration.seconds(300),
        reservedConcurrentExecutions: 256,
        memorySize: 128,
        environment: {
          JOB_DEFINITION: copyJobDefinition.ref,
          JOB_DEFINITION_X_REGION: copyJobDefinitionXRegion.ref,
          JOB_QUEUE: jobQueue.attrJobQueueArn,
          DESTINATION_BUCKET_NAME: destinationBucketName.valueAsString,
          DISABLE_PENDING_JOBS_CHECK: "true",
          MAX_NUMBER_OF_PENDING_JOBS: "96", //== 2x of MaxvCpus
          MN_SIZE_FOR_BATCH_IN_BYTES: "524288000", //500MB - this optimizaed for cost. Set it to 5GB for optimal speed.
          LogLevel: "INFO",
          SOLUTION_IDENTIFIER: "AwsSolution/SO0133/__VERSION__-Mediasync",
          SendAnonymizedMetric: cdk.Fn.findInMap('AnonymizedData', 'SendAnonymizedData', 'Data')
        },
      }
    );
    mediaSyncDriverFunction.node.addDependency(customLambdaRole);
    mediaSyncDriverFunction.node.addDependency(batchAccessPolicy);

    new logs.LogGroup( // NOSONAR
      this,
      "DriverFunctionLogGroup",
      {
        logGroupName: `/aws/lambda/${mediaSyncDriverFunction.functionName}`,
        retention: logs.RetentionDays.ONE_MONTH,
      }
    );

    // Outputs
    new cdk.CfnOutput(this, "LambdaFunctionArn", { // NOSONAR
      // NOSONAR
      description: "LambdaFunctionArn to use with S3 batch",
      value: mediaSyncDriverFunction.functionArn,
      exportName: "LambdaFunctionArn",
    });
    // Outputs
    new cdk.CfnOutput(this, "S3BatchRoleArn", { // NOSONAR
      // NOSONAR
      description: "IAM Role for to use with S3 batch",
      value: s3BatchRole.roleArn,
      exportName: "S3BatchRoleArn",
    });
    // Outputs
    new cdk.CfnOutput(this, "FlowLogBucketName", { // NOSONAR
      // NOSONAR
      description: "Flow log Bucket Name",
      value: flowLogBucket.bucketName,
      exportName: "FlowLogBucketName",
    });
  }
}

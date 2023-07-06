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
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as batch from "aws-cdk-lib/aws-batch";
import { RemovalPolicy } from "aws-cdk-lib";

export class FixityStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    /**
     * CloudFormation Template Descrption
     */
    this.templateOptions.description = `Template for in-place checksum of objects in S3.`;

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
    });

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
     * Vpc, internet gateway, and subnet creation
     */
    const vpc = new ec2.Vpc(this, "Vpc", {
      vpcName: "Vpc",
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"), // NOSONAR
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
    cdk.Tags.of(vpc).add("Name", "MediaExchange Fixity");

    const securityGroup = new ec2.SecurityGroup(this, "SecurityGroup", {
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

    // IAM and instance roles for batch job

    const eCSInstanceRole = new iam.Role(this, "ECSInstanceRole", {
      description: "Role for batch instance profile.",
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
    });
    eCSInstanceRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AmazonEC2ContainerServiceforEC2Role"
      )
    );

    const spotFleetRole = new iam.Role(this, "SPOTFleetRole", {
      description: "Role for spot fleet.",
      assumedBy: new iam.ServicePrincipal("spotfleet.amazonaws.com"),
    });
    spotFleetRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AmazonEC2SpotFleetTaggingRole"
      )
    );

    const batchServiceRole = new iam.Role(this, "BatchServiceRole", {
      description: "Role for batch service.",
      assumedBy: new iam.ServicePrincipal("batch.amazonaws.com"),
    });
    batchServiceRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AWSBatchServiceRole"
      )
    );

    const iamInstanceProfile = new iam.CfnInstanceProfile(
      this,
      "IAMInstanceProfile",
      {
        roles: [eCSInstanceRole.roleName],
      }
    );

    // Initialize compute environment
    const EC2SPOTComputeEnvironment = new batch.CfnComputeEnvironment(
      this,
      "EC2SPOTComputeEnvironment",
      {
        type: "MANAGED",
        serviceRole: batchServiceRole.roleArn,
        computeResources: {
          minvCpus: 0,
          desiredvCpus: 0,
          maxvCpus: 1024,
          instanceTypes: ["c5n", "m5zn", "m5n", "m5dn", "r5n", "r5dn"],
          allocationStrategy: "SPOT_CAPACITY_OPTIMIZED",
          type: "SPOT",
          spotIamFleetRole: spotFleetRole.roleArn,
          subnets: vpc.publicSubnets.map((x) => x.subnetId),
          instanceRole: iamInstanceProfile.attrArn,
          securityGroupIds: [securityGroup.securityGroupId],
        },
      }
    );

    // Create job queue
    const jobQueue = new batch.CfnJobQueue(this, "JobQueue", {
      priority: 1,
      jobQueueName: `mxc-${cdk.Aws.REGION}-${environment.valueAsString}-fixity-ec2spot`,
      computeEnvironmentOrder: [
        {
          order: 1,
          computeEnvironment:
            EC2SPOTComputeEnvironment.attrComputeEnvironmentArn,
        },
      ],
    });

    const batchAccessPolicy = new iam.ManagedPolicy(this, "BatchAccessPolicy", {
      managedPolicyName: `mxc-${cdk.Aws.REGION}-${environment.valueAsString}-fixity-lambda-access-policy`,
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["batch:ListJobs", "batch:TagResource"],
          resources: ["*"],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["batch:SubmitJob", "batch:DescribeJobs"],
          resources: [
            `arn:aws:batch:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:job-definition/*`,
            `arn:aws:batch:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:job-queue/*`,
          ],
        }),
        new iam.PolicyStatement({
          sid: "kms",
          effect: iam.Effect.ALLOW,
          actions: ["kms:Decrypt"],
          resources: ["*"],
        }),
        new iam.PolicyStatement({
          sid: "s3get",
          effect: iam.Effect.ALLOW,
          actions: ["s3:GetObject", "s3:GetObjectVersion"],
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
          actions: ["s3:GetObject", "s3:GetObjectVersion"],
        }),
        new iam.PolicyStatement({
          resources: ["*"],
          effect: iam.Effect.ALLOW,
          actions: [
            "s3:PutObjectTagging",
            "s3:AbortMultipartUpload",
            "s3:ListMultipartUploadParts",
          ],
        }),
        new iam.PolicyStatement({
          resources: ["*"],
          effect: iam.Effect.ALLOW,
          actions: ["kms:Decrypt", "kms:GenerateDataKey*"],
        }),
      ],
    });
    jobRolePolicy.attachToRole(jobRole);

    const hashJobDefinitionSmall = new batch.CfnJobDefinition(
      this,
      "HashJobDefinitionSmall",
      {
        type: "container",
        containerProperties: {
          image: imageName.valueAsString,
          vcpus: 1,
          memory: 2048,
          command: ["Ref::Bucket", "Ref::Key", "2"],
          jobRoleArn: jobRole.roleArn,
        },
        retryStrategy: {
          attempts: 3,
        },
      }
    );

    const hashJobDefinitionLarge = new batch.CfnJobDefinition(
      this,
      "HashJobDefinitionLarge",
      {
        type: "container",
        containerProperties: {
          image: imageName.valueAsString,
          vcpus: 16,
          memory: 16384,
          command: ["Ref::Bucket", "Ref::Key", "32"],
          jobRoleArn: jobRole.roleArn,
        },
        retryStrategy: {
          attempts: 3,
        },
      }
    );

    const executionRole = new iam.Role(this, "ExecutionRole", {
      description: "Role for execution.",
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });
    executionRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AmazonECSTaskExecutionRolePolicy"
      )
    );

    // Roles for s3 batch operation calling

    const s3BatchRole = new iam.Role(this, "S3BatchRole", {
      roleName: `mxc-${cdk.Aws.REGION}-${environment.valueAsString}-fixity-role`,
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

    // Actual lambda driver function

    const driverFunction = new lambda.Function(this, "DriverFunction", {
      runtime: lambda.Runtime.PYTHON_3_8,
      handler: "app.s3_batch_handler",
      description: "Lambda function to be invoked by s3 batch",
      functionName: `mxc-${cdk.Aws.REGION}-${environment.valueAsString}-fixity`,
      role: customLambdaRole,
      code: lambda.Code.fromAsset("lib/fixity/lambda/fixity_driver/"),
      timeout: cdk.Duration.seconds(30),
      reservedConcurrentExecutions: 256,
      memorySize: 128,
      environment: {
        JOB_SIZE_SMALL: hashJobDefinitionSmall.ref,
        JOB_SIZE_LARGE: hashJobDefinitionLarge.ref,
        JOB_SIZE_THRESHOLD: "10737418240",
        JOB_QUEUE: jobQueue.attrJobQueueArn,
        LogLevel: "INFO",
        SOLUTION_IDENTIFIER: "AwsSolution/SO0133/__VERSION__-Fixity",
        SendAnonymizedMetric: cdk.Fn.findInMap('AnonymizedData', 'SendAnonymizedData', 'Data')
      },
    });
    driverFunction.node.addDependency(customLambdaRole);
    driverFunction.node.addDependency(batchAccessPolicy);

    new logs.LogGroup( // NOSONAR
      this,
      "DriverFunctionLogGroup",
      {
        logGroupName: `/aws/lambda/${driverFunction.functionName}`,
        retention: logs.RetentionDays.ONE_MONTH,
      }
    );

    const fixityApi = new apigateway.RestApi(this, "FixityApi", {
      defaultMethodOptions: {
        authorizationType: apigateway.AuthorizationType.IAM,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: ["*"],
        allowMethods: ["POST"],
        allowHeaders: ["X-Forwarded-For"],
        maxAge: cdk.Duration.seconds(1200),
      },
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL],
      },
      deployOptions: {
        dataTraceEnabled: true,
        stageName: "dev",
      },
    });

    // Lambda api function

    const apiFunction = new lambda.Function(this, "ApiFunction", {
      runtime: lambda.Runtime.PYTHON_3_8,
      handler: "app.api_handler",
      description: "Lambda function to be invoked by api",
      role: customLambdaRole,
      code: lambda.Code.fromAsset("lib/fixity/lambda/fixity_driver/"),
      timeout: cdk.Duration.seconds(10),
      reservedConcurrentExecutions: 1,
      memorySize: 128,
      environment: {
        JOB_SIZE_SMALL: hashJobDefinitionSmall.ref,
        JOB_SIZE_LARGE: hashJobDefinitionLarge.ref,
        JOB_SIZE_THRESHOLD: "10737418240",
        JOB_QUEUE: jobQueue.attrJobQueueArn,
        LogLevel: "INFO",
        SOLUTION_IDENTIFIER: "AwsSolution/SO0133/__VERSION__-Fixity",
        SendAnonymizedMetric: cdk.Fn.findInMap('AnonymizedData', 'SendAnonymizedData', 'Data')
      },
    });
    const demo = fixityApi.root.addResource("run");
    demo.addMethod("POST", new apigateway.LambdaIntegration(apiFunction));

    apiFunction.node.addDependency(customLambdaRole);
    apiFunction.node.addDependency(batchAccessPolicy);

    new logs.LogGroup(this, "ApiFunctionLogGroup", { // NOSONAR
      logGroupName: `/aws/lambda/${apiFunction.functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
    });

    // Outputs
    new cdk.CfnOutput(this, "FixtyAPIURL", { // NOSONAR
      // NOSONAR
      description: "Fixity endpoint URL",
      value: `${fixityApi.url}run`,
      exportName: "FixtyAPIURL",
    });
    // Outputs
    new cdk.CfnOutput(this, "FixtyDriverFunctionArn", { // NOSONAR
      // NOSONAR
      description: "Fixity Driver Function Arn",
      value: driverFunction.functionArn,
      exportName: "FixtyDriverFunctionArn",
    });
    // Outputs
    new cdk.CfnOutput(this, "FixtyS3BatchIAMRoleArn", { // NOSONAR
      // NOSONAR
      description: "Fixity IAM Role to use with S3 Batch",
      value: s3BatchRole.roleArn,
      exportName: "FixtyS3BatchIAMRoleArn",
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

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
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as serviceCatalog from "aws-cdk-lib/aws-servicecatalog";
import * as appreg from "@aws-cdk/aws-servicecatalogappregistry-alpha";
import { NagSuppressions } from "cdk-nag";

export class MEStack extends cdk.Stack {
  addPolicy(
    scope: Construct,
    policyName: string,
    role: iam.Role,
    actions: string[]
  ) {
    const policy = new iam.Policy(this, policyName, {
      policyName: policyName,
      statements: [
        new iam.PolicyStatement({
          resources: ["*"],
          actions: actions,
        }),
      ],
    });
    policy.attachToRole(role);

    //cdk_nag
    NagSuppressions.addResourceSuppressions(policy, [
      {
        id: "AwsSolutions-IAM5",
        reason:
          "Resource ARNs are not generated at the time of policy creation",
      },
    ]);

    //cfn_nag
    if (actions.includes("iam:PassRole")) {
      const cfnPolicy = policy.node.findChild("Resource") as iam.CfnPolicy;
      cfnPolicy.cfnOptions.metadata = {
        cfn_nag: {
          rules_to_suppress: [
            {
              id: "F39",
              reason:
                "Resource ARNs are not generated at the time of policy creation",
            },
          ],
        },
      };
    }

    if (actions.includes("servicecatalog:*")) {
      const cfnPolicy = policy.node.findChild("Resource") as iam.CfnPolicy;
      cfnPolicy.cfnOptions.metadata = {
        cfn_nag: {
          rules_to_suppress: [
            {
              id: "F4",
              reason: "All service catalog actions are allowed",
            },
          ],
        },
      };
    }
  }

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    /**
     * CloudFormation Template Descrption
     */
    const solutionId = "SO0133";
    const solutionName = "Media Exchange on AWS";
    this.templateOptions.description = `(${solutionId}) - ${solutionName} __VERSION__ - mediaexchange service catalog setup`;
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
    const owner = new cdk.CfnParameter(this, "Owner", {
      type: "String",
      description: "Maintainer Group",
      allowedPattern: "[A-Za-z0-9]+",
      default: "mediaops",
      constraintDescription:
        "Malformed input-Parameter Owner must only contain uppercase and lowercase letters and numbers",
      maxLength: 64,
      minLength: 2,
    });
    const ownerEmail = new cdk.CfnParameter(this, "OwnerEmails", {
      type: "String",
      description: "Maintainer Group Email",
      default: "mediaops@mycompany.com",
      allowedPattern:
        "^[_A-Za-z0-9-\\+]+(\\.[_A-Za-z0-9-]+)*@[A-Za-z0-9-]+(\\.[A-Za-z0-9]+)*(\\.[A-Za-z]{2,})$",
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
            Label: { default: "Support information" },
            Parameters: [owner.logicalId, ownerEmail.logicalId],
          },
        ],
      },
    };

    /**
     * Mapping for sending anonymized metrics to AWS Solution Builders API
     */
    new cdk.CfnMapping(this, "AnonymizedData", { // NOSONAR
      mapping: {
        SendAnonymizedData: {
          Data: "Yes",
        },
      },
    });

    /**
     * CFN Deployment role
     */
    const customCFNRole = new iam.Role(this, "CFNRole", {
      roleName: `mediaexchange-${cdk.Aws.REGION}-${environment.valueAsString}-cfn-deploy`,
      description: "Service role for Service Catalog portfolio deploy",
      assumedBy: new iam.ServicePrincipal("cloudformation.amazonaws.com"),
    });

    const customCfnActions = [
      "cloudformation:CreateStack",
      "cloudformation:DeleteStack",
      "cloudformation:DescribeStackEvents",
      "cloudformation:DescribeStacks",
      "cloudformation:SetStackPolicy",
      "cloudformation:ValidateTemplate",
      "cloudformation:UpdateStack",
      "cloudformation:CreateChangeSet",
      "cloudformation:DescribeChangeSet",
      "cloudformation:ExecuteChangeSet",
      "cloudformation:ListChangeSets",
      "cloudformation:DeleteChangeSet",
      "cloudformation:TagResource",
      "cloudformation:ListStacks",
    ];

    const customScActions = [
      "cloudformation:GetTemplateSummary",
      "servicecatalog:DescribeProduct",
      "servicecatalog:DescribeProvisioningParameters",
      "servicecatalog:ListLaunchPaths",
      "servicecatalog:ProvisionProduct",
      "ssm:DescribeDocument",
      "ssm:GetAutomationExecution",
      "config:DescribeConfigurationRecorders",
      "config:DescribeConfigurationRecorderStatus",
    ];

    const customSelfScActions = [
      "servicecatalog:DescribeProvisionedProduct",
      "servicecatalog:DescribeRecord",
      "servicecatalog:ListRecordHistory",
      "servicecatalog:ListStackInstancesForProvisionedProduct",
      "servicecatalog:TerminateProvisionedProduct",
      "servicecatalog:UpdateProvisionedProduct",
      "servicecatalog:CreateProvisionedProductPlan",
      "servicecatalog:DescribeProvisionedProductPlan",
      "servicecatalog:ExecuteProvisionedProductPlan",
      "servicecatalog:DeleteProvisionedProductPlan",
      "servicecatalog:ListProvisionedProductPlans",
    ];

    const customResourcePolicy = new iam.Policy(this, "CustomResourcePolicy", {
      policyName: "mxc-servicecatalog-cfn",
      statements: [
        new iam.PolicyStatement({
          resources: [
            `arn:${cdk.Aws.PARTITION}:cloudformation:*:*:stack/*`,
            `arn:${cdk.Aws.PARTITION}:cloudformation:*:*:changeSet/*`,
          ],
          actions: customCfnActions,
        }),
        new iam.PolicyStatement({
          resources: ["*"],
          actions: customScActions,
        }),
        new iam.PolicyStatement({
          resources: ["*"],
          actions: customSelfScActions,
          conditions: {
            StringEquals: {
              "servicecatalog:accountLevel": "self",
            },
          },
        }),
      ],
    });
    customResourcePolicy.attachToRole(customCFNRole);

    //cfn_nag
    const cfnCustomResourceRole = customCFNRole.node.findChild(
      "Resource"
    ) as iam.CfnRole;
    cfnCustomResourceRole.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [
          {
            id: "W11",
            reason:
              "(W11) IAM role should not allow * resource on its permissions policy: Many of the resources created/updated/deleted by this role is created on the fly, as part of the normal usage ot the solution. So, the names are not known at the deployment time.",
          },
          {
            id: "W28",
            reason:
              "(W28) Resource found with an explicit name, this disallows updates that require replacement of this resource",
          },
        ],
      },
    };
    const cfnCustomResourcePolicy = customResourcePolicy.node.findChild(
      "Resource"
    ) as iam.CfnPolicy;
    cfnCustomResourcePolicy.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [
          {
            id: "W11",
            reason:
              "(W11) IAM role should not allow * resource on its permissions policy: Many of the resources created/updated/deleted by this role is created on the fly, as part of the normal usage ot the solution. So, the names are not known at the deployment time.",
          },
          {
            id: "W28",
            reason:
              "(W28) Resource found with an explicit name, this disallows updates that require replacement of this resource",
          },
        ],
      },
    };
    //cdk_nag
    NagSuppressions.addResourceSuppressions(customResourcePolicy, [
      {
        id: "AwsSolutions-IAM5",
        reason:
          "Resource ARNs are not generated at the time of policy creation",
      },
    ]);

    /**
     * Service Catalog Role
     */
    const customServiceCatalogRole = new iam.Role(
      this,
      "ServiceCatalogUserRole",
      {
        roleName: `mediaexchange-${cdk.Aws.REGION}-${environment.valueAsString}-admin`,
        description: "User role for Service Catalog access",
        assumedBy: new iam.AccountPrincipal(cdk.Aws.ACCOUNT_ID),
      }
    );

    const serviceCatalogCfnActions = customCfnActions;
    serviceCatalogCfnActions.push(
      "cloudformation:CreateStackSet",
      "cloudformation:CreateStackInstances",
      "cloudformation:UpdateStackSet",
      "cloudformation:UpdateStackInstances",
      "cloudformation:DeleteStackSet",
      "cloudformation:DeleteStackInstances",
      "cloudformation:DescribeStackSet",
      "cloudformation:DescribeStackInstance",
      "cloudformation:DescribeStackSetOperation",
      "cloudformation:ListStackInstances",
      "cloudformation:ListStackResources",
      "cloudformation:ListStackSetOperations",
      "cloudformation:ListStackSetOperationResults"
    );

    const serviceCatalogScActions = customScActions;
    serviceCatalogScActions.push(
      "servicecatalog:DescribeProductView",
      "servicecatalog:SearchProducts"
    );

    const serviceCatalogSelfScActions = customSelfScActions;
    serviceCatalogSelfScActions.push(
      "servicecatalog:ScanProvisionedProducts",
      "servicecatalog:SearchProvisionedProducts",
      "servicecatalog:ListServiceActionsForProvisioningArtifact",
      "servicecatalog:ExecuteProvisionedProductServiceAction",
      "servicecatalog:DescribeServiceActionExecutionParameters"
    );

    const customServiceCatalogPolicy = new iam.Policy(
      this,
      "ServiceCatalogUserPolicy",
      {
        policyName: "mxc-servicecatalog-cfn",
        statements: [
          new iam.PolicyStatement({
            resources: [
              `arn:${cdk.Aws.PARTITION}:cloudformation:*:*:stack/*`,
              `arn:${cdk.Aws.PARTITION}:cloudformation:*:*:changeSet/*`,
              `arn:${cdk.Aws.PARTITION}:cloudformation:*:*:stackset/*`,
            ],
            actions: serviceCatalogCfnActions,
          }),
          new iam.PolicyStatement({
            resources: ["*"],
            actions: serviceCatalogScActions,
          }),
          new iam.PolicyStatement({
            resources: ["*"],
            actions: serviceCatalogSelfScActions,
            conditions: {
              StringEquals: {
                "servicecatalog:accountLevel": "self",
              },
            },
          }),
        ],
      }
    );
    customServiceCatalogPolicy.attachToRole(customServiceCatalogRole);

    //cfn_nag
    const cfnCustomServiceCatalogRole = customServiceCatalogRole.node.findChild(
      "Resource"
    ) as iam.CfnRole;
    cfnCustomServiceCatalogRole.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [
          {
            id: "W11",
            reason:
              "(W11) IAM role should not allow * resource on its permissions policy: Many of the resources created/updated/deleted by this role is created on the fly, as part of the normal usage ot the solution. So, the names are not known at the deployment time.",
          },
          {
            id: "W28",
            reason:
              "(W28) Resource found with an explicit name, this disallows updates that require replacement of this resource",
          },
        ],
      },
    };
    const cfnServiceCatalogPolicy = customServiceCatalogPolicy.node.findChild(
      "Resource"
    ) as iam.CfnPolicy;
    cfnServiceCatalogPolicy.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [
          {
            id: "W11",
            reason:
              "(W11) IAM role should not allow * resource on its permissions policy: Many of the resources created/updated/deleted by this role is created on the fly, as part of the normal usage ot the solution. So, the names are not known at the deployment time.",
          },
          {
            id: "W28",
            reason:
              "(W28) Resource found with an explicit name, this disallows updates that require replacement of this resource",
          },
        ],
      },
    };
    //cdk_nag
    NagSuppressions.addResourceSuppressions(customServiceCatalogPolicy, [
      {
        id: "AwsSolutions-IAM5",
        reason:
          "Resource ARNs are not generated at the time of policy creation",
      },
    ]);

    // Portfolio and products
    const portfolio = new serviceCatalog.Portfolio(this, "Portfolio", {
      displayName: "Media Exchange On AWS",
      providerName: "AWS Solutions Library",
      description:
        "Group of products related to Media Exchange On AWS solution.",
    });

    new serviceCatalog.CfnPortfolioPrincipalAssociation( // NOSONAR
      this,
      "PortfolioAccessUIRole",
      {
        portfolioId: portfolio.portfolioId,
        principalArn: customServiceCatalogRole.roleArn,
        principalType: "IAM",
      }
    );

    new serviceCatalog.CfnPortfolioPrincipalAssociation( // NOSONAR
      this,
      "PortfolioAccessCliRole",
      {
        portfolioId: portfolio.portfolioId,
        principalArn: customCFNRole.roleArn,
        principalType: "IAM",
      }
    );

    // Publisher product
    const publisher = new serviceCatalog.CloudFormationProduct(
      this,
      "Publisher",
      {
        description:
          "Publisher onboarding template for Media Exchange On AWS Solution",
        productName: "Publisher",
        owner: owner.valueAsString,
        supportDescription: "Please contact mediaops",
        supportEmail: ownerEmail.valueAsString,
        supportUrl: "https://mediaops.mycompany.com",
        distributor: "AWS Solutions Library / Media Exchange On AWS",
        productVersions: [
          {
            cloudFormationTemplate:
              serviceCatalog.CloudFormationTemplate.fromUrl(
                "https://s3.amazonaws.com/__BUCKET_NAME__/__SOLUTION_NAME__/__VERSION__/publisher.template"
              ),
            productVersionName: "latest",
          },
          {
            cloudFormationTemplate:
              serviceCatalog.CloudFormationTemplate.fromUrl(
                "https://s3.amazonaws.com/__BUCKET_NAME__/__SOLUTION_NAME__/__VERSION__/publisher.template"
              ),
            productVersionName: "__VERSION__",
          },
        ],
      }
    );

    portfolio.addProduct(publisher);

    // Subscriber product
    const subscriber = new serviceCatalog.CloudFormationProduct(
      this,
      "Subscriber",
      {
        description:
          "Subscriber onboarding template for Media Exchange On AWS Solution",
        productName: "Subscriber",
        owner: owner.valueAsString,
        supportDescription: "Please contact mediaops",
        supportEmail: ownerEmail.valueAsString,
        supportUrl: "https://mediaops.mycompany.com",
        distributor: "AWS Solutions Library / Media Exchange On AWS",
        productVersions: [
          {
            cloudFormationTemplate:
              serviceCatalog.CloudFormationTemplate.fromUrl(
                "https://s3.amazonaws.com/__BUCKET_NAME__/__SOLUTION_NAME__/__VERSION__/subscriber.template"
              ),
            productVersionName: "latest",
          },
          {
            cloudFormationTemplate:
              serviceCatalog.CloudFormationTemplate.fromUrl(
                "https://s3.amazonaws.com/__BUCKET_NAME__/__SOLUTION_NAME__/__VERSION__/subscriber.template"
              ),
            productVersionName: "__VERSION__",
          },
        ],
      }
    );
    portfolio.addProduct(subscriber);

    // Agreement product
    const agreement = new serviceCatalog.CloudFormationProduct(
      this,
      "Agreement",
      {
        description:
          "Template to setup shared S3 bucket between publisher and subscriber interchange.",
        productName: "Transfer agreement",
        owner: owner.valueAsString,
        supportDescription: "Please contact mediaops",
        supportEmail: ownerEmail.valueAsString,
        supportUrl: "https://mediaops.mycompany.com",
        distributor: "AWS Solutions Library / Media Exchange On AWS",
        productVersions: [
          {
            cloudFormationTemplate:
              serviceCatalog.CloudFormationTemplate.fromUrl(
                "https://s3.amazonaws.com/__BUCKET_NAME__/__SOLUTION_NAME__/__VERSION__/agreement.template"
              ),
            productVersionName: "latest",
          },
          {
            cloudFormationTemplate:
              serviceCatalog.CloudFormationTemplate.fromUrl(
                "https://s3.amazonaws.com/__BUCKET_NAME__/__SOLUTION_NAME__/__VERSION__/agreement.template"
              ),
            productVersionName: "__VERSION__",
          },
        ],
      }
    );

    portfolio.addProduct(agreement);

    /**
     * CFN Deploy Role
     */
    const cfnDeployRole = new iam.Role(this, "CFNDeployRole", {
      description: "Role for ServiceCatalog/Cloudformation.",
      assumedBy: new iam.ServicePrincipal("servicecatalog.amazonaws.com"),
    });

    this.addPolicy(this, "mxc-servicecatalog-base", cfnDeployRole, [
      "servicecatalog:*",
      "cloudformation:CreateStack",
      "cloudformation:DeleteStack",
      "cloudformation:DescribeStackEvents",
      "cloudformation:DescribeStacks",
      "cloudformation:GetTemplateSummary",
      "cloudformation:SetStackPolicy",
      "cloudformation:ValidateTemplate",
      "cloudformation:UpdateStack",
      "s3:GetObject",
    ]);

    this.addPolicy(this, "mxc-publisher-deploy", cfnDeployRole, [
      "events:PutPermission",
      "events:RemovePermission",
      "s3:List*",
      "s3:Get*",
      "s3:Describe*",
      "s3:CreateBucket",
      "s3:DeleteBucket",
      "s3:PutBucketPolicy",
      "s3:DeleteBucketPolicy",
      "s3:PutBucketAcl",
      "s3:PutAccountPublicAccessBlock",
      "s3:PutBucketPublicAccessBlock",
      "s3:PutBucketLogging",
      "s3:PutBucketTagging",
      "s3:PutBucketVersioning",
      "s3:PutEncryptionConfiguration",
      "s3:PutLifecycleConfiguration",
      "sns:Get*",
      "sns:Describe*",
      "sns:CreateTopic",
      "sns:DeleteTopic",
      "sns:List*",
      "sns:SetTopicAttributes",
      "sns:TagResource",
      "sns:UntagResource",
      "sns:ListTagsForResource",
      "sns:Subscribe",
      "sns:Unsubscribe",
      "sns:AddPermission",
      "sns:RemovePermission",
      "sns:ListSubscriptions",
      "sns:ListSubscriptionsByTopic",
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
      "sqs:RemovePermission",
      "sqs:AddPermission",
      "sqs:CreateQueue",
      "sqs:DeleteQueue",
      "sqs:GetQueueAttributes",
      "sqs:SetQueueAttributes",
      "sqs:GetQueueUrl",
      "sqs:ListDeadLetterSourceQueues",
      "sqs:ListQueues",
      "sqs:ListQueueTags",
      "sqs:TagQueue",
      "sqs:UntagQueue",
    ]);

    this.addPolicy(this, "mxc-subscriber-deploy", cfnDeployRole, [
      "sns:Get*",
      "sns:Describe*",
      "sns:CreateTopic",
      "sns:DeleteTopic",
      "sns:List*",
      "sns:SetTopicAttributes",
      "sns:TagResource",
      "sns:UntagResource",
      "sns:ListTagsForResource",
      "sns:Subscribe",
      "sns:Unsubscribe",
      "sns:AddPermission",
      "sns:RemovePermission",
      "sns:ListSubscriptions",
      "sns:ListSubscriptionsByTopic",
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
      "sqs:RemovePermission",
      "sqs:AddPermission",
      "sqs:CreateQueue",
      "sqs:DeleteQueue",
      "sqs:GetQueueAttributes",
      "sqs:SetQueueAttributes",
      "sqs:GetQueueUrl",
      "sqs:ListDeadLetterSourceQueues",
      "sqs:ListQueues",
      "sqs:ListQueueTags",
      "sqs:TagQueue",
      "sqs:UntagQueue",
      "events:PutPermission",
      "events:RemovePermission",
    ]);

    this.addPolicy(this, "mxc-agreement-deploy", cfnDeployRole, [
      "s3:List*",
      "s3:Get*",
      "s3:Describe*",
      "s3:CreateBucket",
      "s3:DeleteBucket",
      "s3:PutBucketPolicy",
      "s3:DeleteBucketPolicy",
      "s3:PutAccountPublicAccessBlock",
      "s3:PutBucketPublicAccessBlock",
      "s3:PutBucketLogging",
      "s3:PutBucketNotification",
      "s3:PutBucketTagging",
      "s3:PutBucketVersioning",
      "s3:PutEncryptionConfiguration",
      "s3:PutLifecycleConfiguration",
      "s3:PutBucketOwnershipControls",
      "s3:DeleteBucketOwnershipControls",
      "lambda:List*",
      "lambda:Get*",
      "lambda:Describe*",
      "lambda:AddPermission",
      "lambda:RemovePermission",
      "lambda:CreateFunction",
      "lambda:DeleteFunction",
      "lambda:PublishVersion",
      "lambda:Update*",
      "lambda:InvokeFunction*",
      "lambda:TagResource",
      "lambda:UntagResource",
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:CreateServiceLinkedRole",
      "iam:AttachRolePolicy",
      "iam:DetachRolePolicy",
      "iam:GetRolePolicy",
      "iam:PutRolePolicy",
      "iam:UpdateAssumeRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:GetRole",
      "iam:PassRole",
      "events:List*",
      "events:Get*",
      "events:Describe*",
      "events:EnableRule",
      "events:DisableRule",
      "events:DeleteRule",
      "events:PutRule",
      "events:PutTargets",
      "events:RemoveTargets",
      "events:TagResource",
      "events:UntagResource",
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
    ]);

    //cfn_nag
    const cfnDeployRoleSource = cfnDeployRole.node.findChild(
      "Resource"
    ) as iam.CfnRole;
    cfnDeployRoleSource.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [
          {
            id: "F3",
            reason:
              "(F3) IAM role should not allow * action on its permissions policy: Many of the resources created/updated/deleted by this role is created on the fly, as part of the normal usage ot the solution. So, the names are not known at the deployment time.",
          },
          {
            id: "F38",
            reason:
              "(F38) IAM role should not allow * resource with PassRole action on its permissions policy: See #F3",
          },
          {
            id: "W11",
            reason:
              "(W11) IAM role should not allow * resource on its permissions policy: See #F3",
          },
        ],
      },
    };

    // Constraints
    const LaunchRoleConstraintPublisher =
      new serviceCatalog.CfnLaunchRoleConstraint(
        this,
        "LaunchRoleConstraintPublisher",
        {
          description:
            "Administrative role for deploying publishers to Media Exchange",
          localRoleName: cfnDeployRole.roleName,
          portfolioId: portfolio.portfolioId,
          productId: publisher.productId,
        }
      );
    LaunchRoleConstraintPublisher.node.addDependency(publisher);
    LaunchRoleConstraintPublisher.node.addDependency(cfnDeployRole);
    LaunchRoleConstraintPublisher.node.addDependency(portfolio);

    const LaunchRoleConstraintSubscriber =
      new serviceCatalog.CfnLaunchRoleConstraint(
        this,
        "LaunchRoleConstraintSubscriber",
        {
          description:
            "Administrative role for deploying subscribers to Media Exchange",
          localRoleName: cfnDeployRole.roleName,
          portfolioId: portfolio.portfolioId,
          productId: subscriber.productId,
        }
      );
    LaunchRoleConstraintSubscriber.node.addDependency(subscriber);
    LaunchRoleConstraintSubscriber.node.addDependency(cfnDeployRole);
    LaunchRoleConstraintSubscriber.node.addDependency(portfolio);

    const LaunchRoleConstraintAgreement =
      new serviceCatalog.CfnLaunchRoleConstraint(
        this,
        "LaunchRoleConstraintAgreement",
        {
          description:
            "Administrative role for deploying publisher & subscriber agreement to Media Exchange",
          localRoleName: cfnDeployRole.roleName,
          portfolioId: portfolio.portfolioId,
          productId: agreement.productId,
        }
      );
    LaunchRoleConstraintAgreement.node.addDependency(agreement);
    LaunchRoleConstraintAgreement.node.addDependency(cfnDeployRole);
    LaunchRoleConstraintAgreement.node.addDependency(portfolio);

    /**
     * AppRegistry
     */
    const applicationName = `media-exchange-on-aws-${cdk.Aws.REGION}-${cdk.Aws.ACCOUNT_ID}`;
    const attributeGroup = new appreg.AttributeGroup(
      this,
      "DefaultApplicationAttributeGroup",
      {
        attributeGroupName: `${solutionId}-${cdk.Aws.REGION}-${cdk.Aws.STACK_NAME}`,
        description: "Attribute group for solution information.",
        attributes: {
          ApplicationType: "AWS-Solutions",
          Version: "__VERSION__",
          SolutionID: solutionId,
          SolutionName: solutionName,
        },
      }
    );
    const appRegistry = new appreg.Application(this, "AppRegistryApp", {
      applicationName: applicationName,
      description: `Service Catalog application to track and manage all your resources. The SolutionId is ${solutionId} and SolutionVersion is __VERSION__.`,
    });
    appRegistry.associateStack(this);
    cdk.Tags.of(appRegistry).add("Solutions:SolutionId", solutionId);
    cdk.Tags.of(appRegistry).add("Solutions:SolutionName", solutionName);
    cdk.Tags.of(appRegistry).add("Solutions:SolutionVersion", "__VERSION__");
    cdk.Tags.of(appRegistry).add("Solutions:ApplicationType", "AWS-Solutions");

    appRegistry.node.addDependency(attributeGroup);
    appRegistry.associateAttributeGroup(attributeGroup);

    /**
     * Custom Resource lambda, role, and policy.
     * Creates custom resources for sending metrics to dashboard
     */
    const customResourceRoleMetrics = new iam.Role(this, 'CustomResourceRoleMetrics', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
    });
    const customResourcePolicyMetrics = new iam.Policy(this, 'CustomResourcePolicyMetrics', {
      statements: [
        new iam.PolicyStatement({
          resources: [`arn:${cdk.Aws.PARTITION}:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/*`],
          actions: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents'
          ]
        }),
      ]
    });
    customResourcePolicyMetrics.attachToRole(customResourceRoleMetrics);

    //cfn_nag
    const cfnCustomResourceRoleMetrics = customResourceRoleMetrics.node.findChild('Resource') as iam.CfnRole;
    cfnCustomResourceRoleMetrics.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [
          {
            id: 'W11',
            reason: '* is required to create CloudWatch logs and interact with metrics actions that do not support resource level permissions'
          }, {
            id: 'W76',
            reason: 'All policies are required by the custom resource.'
          }
        ]
      }
    };
    const cfnCustomResourcePolicyMetrics = customResourcePolicyMetrics.node.findChild('Resource') as iam.CfnPolicy;
    cfnCustomResourcePolicyMetrics.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [
          {
            id: 'W12',
            reason: '* is required to create CloudWatch logs and interact with metrics actions that do not support resource level permissions'
          }, {
            id: 'W76',
            reason: 'High complexity due to number of policy statements needed for creating all custom resources'
          }
        ]
      }
    };
    //cdk_nag
    NagSuppressions.addResourceSuppressions(
      customResourcePolicy,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Resource ARNs are not generated at the time of policy creation'
        }
      ]
    );
    const customResourceLambda = new lambda.Function(this, 'CustomResource', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      description: 'Used to deploy resources not supported by CloudFormation',
      environment: {
        SOLUTION_IDENTIFIER: `AwsSolution/${solutionId}/__VERSION__`
      },
      functionName: `${cdk.Aws.STACK_NAME}-custom-resource`,
      role: customResourceRoleMetrics,
      code: lambda.Code.fromAsset('../custom-resource'),
      timeout: cdk.Duration.seconds(30)
    });
    customResourceLambda.node.addDependency(customResourceRoleMetrics);
    customResourceLambda.node.addDependency(customResourcePolicy);

    //cfn_nag
    const cfnCustomResourceLambda = customResourceLambda.node.findChild('Resource') as lambda.CfnFunction;
    cfnCustomResourceLambda.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [
          {
            id: 'W58',
            reason: 'Invalid warning: function has access to cloudwatch'
          }, {
            id: 'W89',
            reason: 'This CustomResource does not need to be deployed inside a VPC'
          }, {
            id: 'W92',
            reason: 'This CustomResource does not need to define ReservedConcurrentExecutions to reserve simultaneous executions'
          }
        ]
      }
    };
    /**
     * Custom Resource: UUID
     */
    const uuid = new cdk.CustomResource(this, 'UUID', {
      serviceToken: customResourceLambda.functionArn,
      properties: {
        Resource: 'UUID'
      }
    });
    /**
     * Custom Resource: Anonymouse Metric
     */
    new cdk.CustomResource(this, 'AnonymousMetric', { // NOSONAR
      serviceToken: customResourceLambda.functionArn,
      properties: {
        Resource: 'AnonymousMetric',
        SolutionId: solutionId,
        UUID: uuid.getAttString('UUID'),
        Version: '__VERSION__',
        SendAnonymizedMetric: cdk.Fn.findInMap('AnonymizedData', 'SendAnonymizedData', 'Data')
      }
    });

    // Outputs
    new cdk.CfnOutput(this, "CFNDeployerRole", { // NOSONAR
      description: "Deployment Role",
      value: customCFNRole.roleArn,
      exportName: "CFNDeployerRole",
    });
    new cdk.CfnOutput(this, "PublisherProductId", { // NOSONAR
      description: "ProductId of the publisher product",
      value: publisher.productId,
      exportName: `mxc-${cdk.Aws.REGION}-${environment.valueAsString}-sc-publisher-productid`,
    });
    new cdk.CfnOutput(this, "SubscriberProductId", { // NOSONAR
      description: "ProductId of the subscriber product",
      value: subscriber.productId,
      exportName: `mxc-${cdk.Aws.REGION}-${environment.valueAsString}-sc-subscriber-productid`,
    });
    new cdk.CfnOutput(this, "AgreementProductId", { // NOSONAR
      description: "ProductId of the agreement product",
      value: agreement.productId,
      exportName: `mxc-${cdk.Aws.REGION}-${environment.valueAsString}-sc-agreement-productid`,
    });
    new cdk.CfnOutput(this, "ConsoleUrl", { // NOSONAR
      description: "ServiceCatalog portfolio manager url.",
      value: `https://signin.aws.amazon.com/switchrole?roleName=${customServiceCatalogRole.roleName}&account=${cdk.Aws.ACCOUNT_ID}&region=${cdk.Aws.REGION}&redirect_uri=https://console.aws.amazon.com/servicecatalog/home?region=${cdk.Aws.REGION}&isSceuc=true#/products`,
    });

    /**
     * Tag all resources with Solution Id
     */
    cdk.Tags.of(this).add("SolutionId", solutionId);
  }
}

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
import * as serviceCatalog from "aws-cdk-lib/aws-servicecatalog";

export class ProvisionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    /**
     * CloudFormation Template Descrption
     */
    const solutionId = "SO0133";
    const solutionName = "Media Exchange on AWS";
    this.templateOptions.description = `(${solutionId}) - ${solutionName} __VERSION__ - media exchange publisher/subscriber/agreement provisioning.`;
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
    const subscriberName = new cdk.CfnParameter(this, "SubscriberName", {
      type: "String",
      description: "A name for subscriber account.",
      allowedPattern: "[A-Za-z0-9-]+",
      constraintDescription:
        "Malformed input-Parameter SubscriberName must only contain uppercase and lowercase letters and numbers",
      maxLength: 64,
      minLength: 3,
    });
    const subscriberAccountId = new cdk.CfnParameter(
      this,
      "SubscriberAccountId",
      {
        type: "String",
        description:
          "The accountId of the Subscriber. This parameter is ignored if you specify SubscriberRole.",
        allowedPattern: "^\\d{12}$",
        constraintDescription:
          "Malformed input-Parameter SubscriberAccountId must be a 12 digit number.",
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
            Label: { default: "Configuration" },
            Parameters: [
              publisherName.logicalId,
              subscriberName.logicalId,
              publisherAccountId.logicalId,
              subscriberAccountId.logicalId,
            ],
          },
        ],
      },
    };
    // Get publisher product Id from serviceCatalog
    const publisherProductId = serviceCatalog.Product.fromProductArn(
      this,
      "PublisherProductId",
      cdk.Fn.importValue(
        `mxc-${cdk.Aws.REGION}-${environment.valueAsString}-sc-publisher-productid`
      )
    );

    // Publisher provisioned product
    const publisher = new serviceCatalog.CfnCloudFormationProvisionedProduct(
      this,
      "Publisher",
      {
        provisionedProductName: `mediaexchange-${publisherName.valueAsString}-publisher`,
        productId: publisherProductId.productId,
        provisioningArtifactName: "latest",
        provisioningParameters: [
          {
            key: "Environment",
            value: environment.valueAsString,
          },
          {
            key: "PublisherName",
            value: publisherName.valueAsString,
          },
          {
            key: "PublisherAccountId",
            value: publisherAccountId.valueAsString,
          },
        ],
      }
    );

    // Subscriber provisioned product
    const subscriberProductId = serviceCatalog.Product.fromProductArn(
      this,
      "SubscriberProductId",
      cdk.Fn.importValue(
        `mxc-${cdk.Aws.REGION}-${environment.valueAsString}-sc-subscriber-productid`
      )
    );

    const subscriber = new serviceCatalog.CfnCloudFormationProvisionedProduct(
      this,
      "Subscriber",
      {
        provisionedProductName: `mediaexchange-${subscriberName.valueAsString}-subscriber`,
        productId: subscriberProductId.productId,
        provisioningArtifactName: "latest",
        provisioningParameters: [
          {
            key: "Environment",
            value: environment.valueAsString,
          },
          {
            key: "SubscriberName",
            value: subscriberName.valueAsString,
          },
          {
            key: "SubscriberAccountId",
            value: subscriberAccountId.valueAsString,
          },
          {
            key: "Email",
            value: "nomail@nomail.com",
          },
        ],
      }
    );

    // Agreement provisioned product
    const agreementProductId = serviceCatalog.Product.fromProductArn(
      this,
      "AgreementProductId",
      cdk.Fn.importValue(
        `mxc-${cdk.Aws.REGION}-${environment.valueAsString}-sc-agreement-productid`
      )
    );

    const agreement = new serviceCatalog.CfnCloudFormationProvisionedProduct(
      this,
      "Agreement",
      {
        provisionedProductName: `mediaexchange-${publisherName.valueAsString}-${subscriberName.valueAsString}-transfer-agreement`,
        productId: agreementProductId.productId,
        provisioningArtifactName: "latest",
        provisioningParameters: [
          {
            key: "Environment",
            value: environment.valueAsString,
          },
          {
            key: "PublisherName",
            value: publisherName.valueAsString,
          },
          {
            key: "SubscriberName",
            value: subscriberName.valueAsString,
          },
        ],
      }
    );
    agreement.node.addDependency(publisher);
    agreement.node.addDependency(subscriber);

    // outputs
    new cdk.CfnOutput(this, "AgreementStackArn", { // NOSONAR
      // NOSONAR
      description: "Agreement Stack Arn",
      value: agreement.attrCloudformationStackArn,
    });
  }
}

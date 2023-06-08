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
import * as ecr from "aws-cdk-lib/aws-ecr";

export class MediaSyncRepositoryStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    /**
     * CloudFormation Template Descrption
     */
    this.templateOptions.description = `Cloudformation template for creating ECR Repository.`;

    /**
     * Cfn Parameters
     */
    const repositoryName = new cdk.CfnParameter(this, "RepositoryName", {
      type: "String",
      description: "Repository Name",
    });

    /**
     * Create ECR Repository
     */
    new ecr.Repository(this, "Repo", { // NOSONAR
      repositoryName: repositoryName.valueAsString,
      lifecycleRules: [
        {
          rulePriority: 1,
          description: "keep only one image",
          tagStatus: ecr.TagStatus.ANY,
          maxImageCount: 1,
        },
      ],
    });
  }
}

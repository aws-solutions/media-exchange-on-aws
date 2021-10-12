#!/bin/bash -e

# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

## run_hash_job.sh <bucket name of inventory file> <key name of inventory file>

[[ -z "$1" ]] && { echo "Error: <bucket name of inventory file> is required"; exit 1; }
[[ -z "$2" ]] && { echo "Error: <key name of inventory file> is required"; exit 1; }


ENV="${ENV:-dev}"
STACK_NAME=mediaexchange-tools-fixity-$ENV
BUCKET=$1
KEY=$2

if ! command -v aws &> /dev/null
then
    echo "awscli is not installed; please install aws-cli by following install guide from here: https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html"
    exit
fi

DEFAULT_REGION=$(aws configure get region --output text)
AWS_REGION=${AWS_REGION:-$DEFAULT_REGION}
LAMBDA_ARN=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey == 'FixtyDriverFunctionArn'].OutputValue" --output text)
ROLE_ARN=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey == 'FixtyS3BatchIAMRoleArn'].OutputValue" --output text)

# JOB_QUEUE_ARN=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey == 'JobQueue'].OutputValue" --output text)

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

ETAG=$(aws s3api head-object --bucket $BUCKET --key $KEY --query "ETag" --output text)

MANIFEST="{\"Spec\":{\"Format\":\"S3BatchOperations_CSV_20180820\",\"Fields\":[\"Bucket\",\"Key\"]},\"Location\":{\"ObjectArn\":\"arn:aws:s3:::$BUCKET/$KEY\",\"ETag\":$ETAG}}"

REPORT="{\"Bucket\":\"arn:aws:s3:::$BUCKET\",\"Prefix\":\"$KEY\",\"Format\":\"Report_CSV_20180820\",\"Enabled\":true,\"ReportScope\":\"AllTasks\"}"

OPERATION="{\"LambdaInvoke\":{\"FunctionArn\":\"$LAMBDA_ARN\"}}"

JobId=$(aws \
    s3control create-job \
    --account-id $ACCOUNT_ID \
    --no-confirmation-required \
    --manifest $MANIFEST \
    --operation $OPERATION \
    --report $REPORT \
    --role-arn $ROLE_ARN \
    --client-request-token "$(uuidgen)" \
    --priority 10 \
    --description "fixity" --query "JobId" --output text);

echo "See your job status at https://$REGION.console.aws.amazon.com/batch/v2/home?region=$REGION#dashboard"

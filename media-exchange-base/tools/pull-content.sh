#! /bin/bash

# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0


## set access keys, profile etc. -

# export AWS_ACCESS_KEY_ID=
# export AWS_SECRET_ACCESS_KEY=
# export AWS_SESSION_TOKEN=
# export AWS_REGION=

##

echo caller identity is $(aws sts get-caller-identity --query Arn)

source ./common.env
source ./subscriber.env

aws s3api get-object --bucket $BUCKET_NAME --key $FILE_NAME /tmp/$FILE_NAME

echo checksum is $(openssl dgst -sha256 /tmp/$FILE_NAME | cut -d' ' -f2)

rm -rf /tmp/$FILE_NAME

### list

echo getting list of objects
aws s3api list-objects-v2 --bucket $BUCKET_NAME --fetch-owner

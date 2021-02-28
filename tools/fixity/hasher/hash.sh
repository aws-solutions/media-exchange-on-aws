#!/bin/bash -xe

# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

# usage: ./hash.sh s3://<bucket>/<key> <number of workers>

[[ -z $1 ]] && { echo "Error: s3://<bucket>/<key> is required"; exit 1; }
[[ -z $2 ]] && { echo "Error: number of workers is required"; exit 1; }

BUCKET=$(echo $1 | cut -f3 -d/)
KEY=$(echo $1 | cut -f4 -d/)

AWS_REGION=us-west-2 s3pcat --bucket $BUCKET --key $KEY --workers $2 | tee >(md5sum | cut -d ' ' -f1 > /tmp/MD5.result) >(sha1sum | cut -d ' ' -f1 > /tmp/SHA1.result) >(xxhsum | cut -d ' ' -f1 > /tmp/xxhsum.result) > /dev/null

aws s3api put-object-tagging --bucket $BUCKET --key $KEY --tagging "TagSet=[{Key=Content-MD5,Value=$(cat /tmp/MD5.result)},{Key=Content-SHA1,Value=$(cat /tmp/SHA1.result)},{Key=Content-XXHash,Value=$(cat /tmp/xxhsum.result)}]"

#!/bin/bash -xe

# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

# usage: ./hash.sh <bucket> <key> <no of workers>

[[ -z $1 ]] && { echo "Error: <bucket> is required"; exit 1; }
[[ -z $2 ]] && { echo "Error: <key> is required"; exit 1; }
[[ -z $3 ]] && { echo "Error: <no of workers> is required"; exit 1; }

BUCKET=$1
KEY=$2
WORKERS=$3

AWS_REGION=us-west-2 s3pcat --bucket $BUCKET --key $KEY --workers $WORKERS | tee >(md5sum | cut -d ' ' -f1 > /tmp/MD5.result) >(sha1sum | cut -d ' ' -f1 > /tmp/SHA1.result) >(xxhsum | cut -d ' ' -f1 > /tmp/xxhsum.result) > /dev/null

aws s3api put-object-tagging --bucket $BUCKET --key $KEY --tagging "TagSet=[{Key=Content-MD5,Value=$(cat /tmp/MD5.result)},{Key=Content-SHA1,Value=$(cat /tmp/SHA1.result)},{Key=Content-XXHash,Value=$(cat /tmp/xxhsum.result)}]"

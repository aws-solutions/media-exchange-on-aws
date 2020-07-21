#!/bin/bash -xe

# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

# usage: ./hash.sh s3://<bucket>/<key>

[[ -z $1 ]] && { echo "Error: s3://<bucket>/<key> is required"; exit 1; }


aws s3 cp "$1" - | tee >(md5sum | cut -d ' ' -f1 > /tmp/MD5.result) >(sha1sum | cut -d ' ' -f1 > /tmp/SHA1.result) >(xxhsum | cut -d ' ' -f1 > /tmp/xxhsum.result) >(xxh64sum | cut -d ' ' -f1 > /tmp/xxh64sum.result) > /dev/null

BUCKET=$(echo $1 | cut -f3 -d/)
KEY=$(echo $1 | cut -f4 -d/)

aws s3api put-object-tagging --bucket $BUCKET --key $KEY --tagging "TagSet=[{Key=Content-MD5,Value=$(cat /tmp/MD5.result)},{Key=Content-SHA1,Value=$(cat /tmp/SHA1.result)},{Key=Content-XXHash,Value=$(cat /tmp/xxhsum.result)},{Key=Content-XX64Hash,Value=$(cat /tmp/xxh64sum.result)}]"

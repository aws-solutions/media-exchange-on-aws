#!/bin/bash -xe

# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

[[ -z $1 ]] && { echo "Error: s3://<Source> is required"; exit 1; }

aws s3 cp "$1" - | tee >(md5sum | cut -d ' ' -f1 > /tmp/MD5.result) >(sha1sum | cut -d ' ' -f1 > /tmp/SHA1.result) >(xxhsum | cut -d ' ' -f1 > /tmp/xxhsum.result) >(xxh64sum | cut -d ' ' -f1 > /tmp/xxh64sum.result) > /dev/null

aws s3 cp "$1" "$1" --metadata-directive REPLACE --metadata Content-MD5=$(cat /tmp/MD5.result),Content-SHA1=$(cat /tmp/SHA1.result),Content-XXHash=$(cat /tmp/xxhsum.result),Content-XX64Hash=$(cat /tmp/xxh64sum.result)  --acl bucket-owner-full-control

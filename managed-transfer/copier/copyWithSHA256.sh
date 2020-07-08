#!/bin/bash -x

[[ -z "$1" ]] && { echo "Error: s3://<Source> is required"; exit 1; }
[[ -z "$2" ]] && { echo "Error: s3://<Destination> is required"; exit 1; }
[[ -z "$3" ]] && { echo "Error: KMS Key Arn is required"; exit 1; }
[[ -z "$4" ]] && { echo "Error: S3 Cannoical Id is required"; exit 1; }


aws s3 cp $1 - | sha256sum | cut -d ' ' -f1 | xargs -I {} aws s3 cp $1 $2 --copy-props metadata-directive --metadata-directive REPLACE --metadata Content-SHA256={} --sse aws:kms --sse-kms-key-id $3 --grants read=id=$4

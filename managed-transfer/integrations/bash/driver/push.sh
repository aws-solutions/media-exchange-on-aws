#!/bin/bash -e

# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

CHECKSUM=false
KMS_KEY_ID=''
SUBSCRIBER_CANONICAL_ACCOUNT_ID=''

USAGE="Usage: push.sh [-h] [-c] -k <kms key arn> -s <subscriber canonical account id> s3://<source-bucket/<sourcekey> s3://<destination-bucket>/<destinationkey> "


while getopts ":hck:s:" opt; do
  case ${opt} in
    h )
      echo $USAGE
      exit 0
      ;;
    c )
      CHECKSUM=true
      ;;
    k )
      KMS_KEY_ID=$OPTARG
      ;;
    s )
      SUBSCRIBER_CANONICAL_ACCOUNT_ID=$OPTARG
      ;;
    \? )
      echo "Invalid Option: -$OPTARG" 1>&2
      exit 1
      ;;
  esac
done
shift $((OPTIND -1))

[[ -z "$1" ]] && { echo $USAGE; exit 1; }
[[ -z "$2" ]] && { echo $USAGE; exit 1; }
[[ -z "$KMS_KEY_ID" ]] && { echo $USAGE; exit 1; }
[[ -z "$SUBSCRIBER_CANONICAL_ACCOUNT_ID" ]] && { echo $USAGE; exit 1; }

jobid=''

if [[ "$CHECKSUM" == "true" ]] ; then
  jobid=$(aws batch submit-job --job-name CopyJobFromBash --job-definition Copy --job-queue mediaexchange-managedtransfer-queue  --container-overrides command=pushWithCheckSum.sh,$1,$2,$KMS_KEY_ID,$SUBSCRIBER_CANONICAL_ACCOUNT_ID --query jobId --output text)
else
  inputjson="{\"jobName\":\"CopyJobFromBash\",\"jobQueue\":\"mediaexchange-managedtransfer-queue\",\"jobDefinition\":\"Copy\",\"containerOverrides\":{\"command\":[\"aws\",\"s3\",\"cp\",\"$1\",\"$2\",\"--copy-props\",\"metadata-directive\",\"--sse\",\"'aws:kms'\",\"--sse-kms-key-id\",\"$KMS_KEY_ID\",\"--grants\",\"read=id=$SUBSCRIBER_CANONICAL_ACCOUNT_ID\"]}}"

  jobid=$(aws batch submit-job --cli-input-json $inputjson --query jobId --output text)
fi

SECONDS=0
STATUS=$(aws batch describe-jobs --jobs $jobid --query "jobs[0].status" --output text)

while [ "$STATUS" != "SUCCEEDED" ] && [ "$STATUS" != "FAILED" ] ; do
  printf "\r$STATUS.... total: $SECONDS seconds"
  sleep 1
  STATUS=$(aws batch describe-jobs --jobs $jobid --query "jobs[0].status" --output text)
done
printf "\r$STATUS\n"

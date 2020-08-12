#!/bin/bash -e

# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

CHECKSUM=false

while getopts ":hc" opt; do
  case ${opt} in
    h )
      echo "Usage: pull.sh [-h] [-c] s3://<source-bucket/<sourcekey> s3://<destination-bucket>/<destinationkey>"
      exit 0
      ;;
    c )
      CHECKSUM=true
      ;;
    \? )
      echo "Invalid Option: -$OPTARG" 1>&2
      exit 1
      ;;
  esac
done
shift $((OPTIND -1))

[[ -z "$1" ]] && { echo "Error: s3://<source-bucket/<sourcekey> is required"; exit 1; }
[[ -z "$2" ]] && { echo "Error: s3://<destination-bucket>/<destinationkey> is required"; exit 1; }

if [[ "$CHECKSUM" == "true" ]] ; then
  jobid=$(aws batch submit-job --job-name CopyJobFromBash --job-definition Copy --job-queue mediaexchange-managedtransfer-queue  --container-overrides command=pullWithCheckSum.sh,$1,$2 --query jobId --output text)
else
  jobid=$(aws batch submit-job --job-name CopyJobFromBash --job-definition Copy --job-queue mediaexchange-managedtransfer-queue  --container-overrides command=aws,s3,cp,$1,$2,'--recursive','--copy-props',metadata-directive,'--acl',bucket-owner-full-control --query jobId --output text)
fi

SECONDS=0
STATUS=$(aws batch describe-jobs --jobs $jobid --query "jobs[0].status" --output text)

while [ "$STATUS" != "SUCCEEDED" ] && [ "$STATUS" != "FAILED" ] ; do
  printf "\r$STATUS.... total: $SECONDS seconds"
  sleep 1
  STATUS=$(aws batch describe-jobs --jobs $jobid --query "jobs[0].status" --output text)
done
printf "\r$STATUS\n"

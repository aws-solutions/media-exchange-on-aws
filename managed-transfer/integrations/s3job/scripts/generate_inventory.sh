#!/bin/bash

## generate_inventory.sh <bucket name> > <filename>

[[ -z "$1" ]] && { echo "Error: <bucket name> is required"; exit 1; }

if ! command -v aws &> /dev/null
then
    echo "awscli is not installed; please install aws-cli by following install guide from here: https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html" 
    exit
fi

if ! command -v jq &> /dev/null
then
    echo "jq is not installed; please download and install jq from here: https://stedolan.github.io/jq/download/" 
    exit
fi

aws s3api list-objects-v2 --bucket $1 --no-fetch-owner --page-size 100 --query "Contents[].['$1', Key]" | jq -r ".[]| @csv"


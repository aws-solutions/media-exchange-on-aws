#! /bin/bash

## set access keys, profile etc. -

# export AWS_ACCESS_KEY_ID=
# export AWS_SECRET_ACCESS_KEY=
# export AWS_SESSION_TOKEN=
# export AWS_REGION=

##

echo caller identity is $(aws sts get-caller-identity --query Arn)

echo copying from exchange

PUBLISHER_BUCKET_NAME="mxc-publisher-us-west-2-dev-latest-657474709706"
ORDER_ID='ORD-245778'
PREFIX='holyflix'
FILE_NAME='media-file.mp4'

aws s3api get-object --bucket $PUBLISHER_BUCKET_NAME --key $PREFIX/$ORDER_ID/$FILE_NAME /tmp/media-file.mp4

echo checksum is $(openssl dgst -sha256 /tmp/media-file.mp4 | cut -d' ' -f2)

rm -rf /tmp/media-file.mp4

### list 
SUBSCRIBER_EXTERNAL_ID="prodey+distribution@amazon.com"
MXC_ROLE_ARN="arn:aws:iam::534054367376:role/media-exchange-subscriber-1-CrossAccountRole-9PF0Y282CSZK"
SESSION_NAME="mxc-read-session"

echo assuming cross account role in media exchange
resp=$(aws sts assume-role --role-arn $MXC_ROLE_ARN --role-session-name $SESSION_NAME --external-id $SUBSCRIBER_EXTERNAL_ID)

export AWS_ACCESS_KEY_ID=$(echo $resp | jq -r .Credentials.AccessKeyId)
export AWS_SECRET_ACCESS_KEY=$(echo $resp | jq -r .Credentials.SecretAccessKey)
export AWS_SESSION_TOKEN=$(echo $resp | jq -r .Credentials.SessionToken)

echo caller identity is $(aws sts get-caller-identity --query Arn)

echo getting list of objects
aws s3api list-objects-v2 --bucket $PUBLISHER_BUCKET_NAME --prefix $PREFIX --fetch-owner



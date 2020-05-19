#! /bin/bash

## set access keys, profile etc. -

# export AWS_ACCESS_KEY_ID=
# export AWS_SECRET_ACCESS_KEY=
# export AWS_SESSION_TOKEN=
# export AWS_REGION=

# set -x

##

echo caller identity is $(aws sts get-caller-identity --query Arn)

AWS_REGION="us-west-2"
PUBLISHER_BUCKET_NAME="mxc-publisher-us-west-2-dev-latest-657474709706"
KMS_KEY_ID="arn:aws:kms:us-west-2:534054367376:key/5e2f517a-7d76-48c7-b444-c72c211cfcda"
SUBSCRIBER_CANNONICAL_ID="6a4b6571fc44c04d8cd85b35525373fb505dc69cfc5d9b509163d45825d62436"

ORDER_ID='ORD-245778'
PREFIX='holyflix'
FILE_NAME='media-file.mp4'
echo generating a 1MB file
dd if=/dev/random of=/tmp/$FILE_NAME count=1024 bs=1024 2>/dev/null
CHECKSUM=$(openssl dgst -sha256 /tmp/$FILE_NAME | cut -d' ' -f2)
echo checksum is $CHECKSUM

echo copying to exchange 
aws s3api put-object --bucket $PUBLISHER_BUCKET_NAME --key $PREFIX/$ORDER_ID/$FILE_NAME  --body /tmp/$FILE_NAME   --server-side-encryption aws:kms --ssekms-key-id $KMS_KEY_ID --grant-read id=$SUBSCRIBER_CANNONICAL_ID

#read 

PUBLISHER_EXTERNAL_ID="prodey+publisher@amazon.com"
PUBLISHER_ROLE_ARN="arn:aws:iam::534054367376:role/media-exchange-publisher-1-CrossAccountRole-PSPXJ7EC0FJ9"
SESSION_NAME="mxc-read-session"

echo assuming cross account role in media exchange
resp=$(aws sts assume-role --role-arn $PUBLISHER_ROLE_ARN --role-session-name $SESSION_NAME --external-id $PUBLISHER_EXTERNAL_ID)

export AWS_ACCESS_KEY_ID=$(echo $resp | jq -r .Credentials.AccessKeyId)
export AWS_SECRET_ACCESS_KEY=$(echo $resp | jq -r .Credentials.SecretAccessKey)
export AWS_SESSION_TOKEN=$(echo $resp | jq -r .Credentials.SessionToken)

echo caller identity is $(aws sts get-caller-identity --query Arn)

echo getting list of objects
aws s3api list-objects-v2 --bucket $PUBLISHER_BUCKET_NAME --prefix $PREFIX --fetch-owner

ts=$(date -u +'%Y-%m-%dT%H:%M:%SZ')

echo sending events

EVENT_BUS_NAME='mxc-events-534054367376-us-west-2-dev-latest'
aws --region $AWS_REGION events put-events --entries "Time=$ts,Source=mxc.publisher,DetailType=Event from publisher,Detail='{
    \"eventVersion\": \"latest\",
    \"eventTime\": \"$ts\",
    \"eventSource\": \"mxc.mydomain.com\",
    \"eventName\": \"AssetsShared\",
    \"awsRegion\": \"$AWS_REGION\",
    \"sourceIPAddress\": \"52.95.4.10\",
    \"userAgent\": \"GNU bash, version 3.2.57(1)-release (x86_64-apple-darwin18)\",
    \"assets\": {
        \"bucket\": \"$PUBLISHER_BUCKET_NAME\",
        \"keys\": {
           \"$CHECKSUM\" : \"$PREFIX/$ORDER_ID/$FILE\"
        }
    },
    \"eventID\": \"1b0c5952-91c6-498d-bf5f-95c250920d8b\",
    \"eventType\": \"ApplicationEvent\",
    \"subscriberCannonicalAccountId\": \"$SUBSCRIBER_CANNONICAL_ID\"}',EventBusName=$EVENT_BUS_NAME"

rm -rf /tmp/$FILE_NAME

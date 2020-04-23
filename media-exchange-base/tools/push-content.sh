#! /bin/bash

## set access keys, profile etc. -

# export AWS_ACCESS_KEY_ID=
# export AWS_SECRET_ACCESS_KEY=
# export AWS_SESSION_TOKEN=
# export AWS_REGION=

# set -x

##

echo caller identity is $(aws sts get-caller-identity --query Arn)

AWS_REGION="us-east-2"
MEDIA_EXCHNAGE_BUCKET_NAME="mxc-publisher-us-east-2-dev-latest-702582666339"
KMS_KEY_ID="arn:aws:kms:us-east-2:472352166085:key/82fdc962-f624-46c3-9b32-f4610e49758c"
SUBSCRIBER_CANNONICAL_ID="73bdba08d78f9958eda14541b6bbe42178fcdd767cc1502b5ee397f3687efcac"

ORDER_ID='ORD-245778'
PREFIX='1-1'
FILE_NAME='media-file.mp4'
echo generating a 1MB file
dd if=/dev/random of=/tmp/$FILE_NAME count=1024 bs=1024 2>/dev/null
CHECKSUM=$(openssl dgst -sha256 /tmp/$FILE_NAME | cut -d' ' -f2)
echo checksum is $CHECKSUM

echo copying to exchange 
aws s3api put-object --bucket $MEDIA_EXCHNAGE_BUCKET_NAME --key $PREFIX/$ORDER_ID/$FILE_NAME  --body /tmp/$FILE_NAME   --server-side-encryption aws:kms --ssekms-key-id $KMS_KEY_ID --grant-read id=$SUBSCRIBER_CANNONICAL_ID

#read 

PRODUCER_EXTERNAL_ID="prodey+publisher@amazon.com"
MXC_ROLE_ARN="arn:aws:iam::472352166085:role/mxc-publisher-1-dev-stack-CrossAccountRole-1LU83511B4J9K"
SESSION_NAME="mxc-read-session"

echo assuming cross account role in media exchange
resp=$(aws sts assume-role --role-arn $MXC_ROLE_ARN --role-session-name $SESSION_NAME --external-id $PRODUCER_EXTERNAL_ID)

export AWS_ACCESS_KEY_ID=$(echo $resp | jq -r .Credentials.AccessKeyId)
export AWS_SECRET_ACCESS_KEY=$(echo $resp | jq -r .Credentials.SecretAccessKey)
export AWS_SESSION_TOKEN=$(echo $resp | jq -r .Credentials.SessionToken)

echo caller identity is $(aws sts get-caller-identity --query Arn)

echo getting list of objects
aws s3api list-objects-v2 --bucket $MEDIA_EXCHNAGE_BUCKET_NAME --prefix $PREFIX --fetch-owner

ts=$(date -u +'%Y-%m-%dT%H:%M:%SZ')

echo sending events

EVENT_BUS_NAME='mxc-events-472352166085-us-east-2-dev-latest'
aws --region $AWS_REGION events put-events --entries "Time=$ts,Source=mxc.publisher,DetailType=Event from publisher,Detail='{
    \"eventVersion\": \"latest\",
    \"eventTime\": \"$ts\",
    \"eventSource\": \"mxc.mydomain.com\",
    \"eventName\": \"AssetsShared\",
    \"awsRegion\": \"$AWS_REGION\",
    \"sourceIPAddress\": \"52.95.4.10\",
    \"userAgent\": \"GNU bash, version 3.2.57(1)-release (x86_64-apple-darwin18)\",
    \"assets\": {
        \"bucket\": \"$MEDIA_EXCHNAGE_BUCKET_NAME\",
        \"keys\": {
           \"$CHECKSUM\" : \"$PREFIX/$ORDER_ID/$FILE\"
        }
    },
    \"eventID\": \"1b0c5952-91c6-498d-bf5f-95c250920d8b\",
    \"eventType\": \"ApplicationEvent\",
    \"subscriberCannonicalAccountId\": \"$SUBSCRIBER_CANNONICAL_ID\"}',EventBusName=$EVENT_BUS_NAME"

rm -rf /tmp/$FILE_NAME

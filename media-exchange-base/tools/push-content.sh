#! /bin/bash

## set access keys, profile etc. -

# export AWS_ACCESS_KEY_ID=
# export AWS_SECRET_ACCESS_KEY=
# export AWS_SESSION_TOKEN=
# export AWS_REGION=

# instructions
# run make agreement to generate the configuration file at build/<publisher>.env
# this script load the environment

##

echo caller identity is $(aws sts get-caller-identity --query Arn)

source ./common.env
source ./publisher.env

echo running on behalf of $NAME

echo generating a 1MB file
dd if=/dev/random of=/tmp/$FILE_NAME count=1024 bs=1024 2>/dev/null
CHECKSUM=$(openssl dgst -sha256 /tmp/$FILE_NAME | cut -d' ' -f2)
echo checksum is $CHECKSUM

echo copying to s3
aws s3api put-object --bucket $BUCKET_NAME --key $SUBSCRIBER_PREFIX/$FILE_NAME  --body /tmp/$FILE_NAME   --server-side-encryption aws:kms --ssekms-key-id $KMS_KEY_ID --grant-read id=$SUBSCRIBER_CANNONICAL_ID

rm -rf /tmp/$FILE_NAME

echo assuming cross account role in media exchange
resp=$(aws sts assume-role --role-arn $PUBLISHER_ROLE_ARN --role-session-name $SESSION_NAME)

export AWS_ACCESS_KEY_ID=$(echo $resp | jq -r .Credentials.AccessKeyId)
export AWS_SECRET_ACCESS_KEY=$(echo $resp | jq -r .Credentials.SecretAccessKey)
export AWS_SESSION_TOKEN=$(echo $resp | jq -r .Credentials.SessionToken)

echo caller identity is $(aws sts get-caller-identity --query Arn)

echo getting list of objects
aws s3api list-objects-v2 --bucket $BUCKET_NAME --prefix $SUBSCRIBER_PREFIX --fetch-owner

ts=$(date -u +'%Y-%m-%dT%H:%M:%SZ')

echo sending notification

aws --region $AWS_REGION events put-events --entries "Time=$ts,Source=mxc.publisher,DetailType=Event from publisher,Detail='{
    \"eventVersion\": \"latest\",
    \"eventTime\": \"$ts\",
    \"eventSource\": \"mxc.mydomain.com\",
    \"eventName\": \"AssetsShared\",
    \"awsRegion\": \"$AWS_REGION\",
    \"sourceIPAddress\": \"52.95.4.10\",
    \"userAgent\": \"GNU bash, version 3.2.57(1)-release (x86_64-apple-darwin18)\",
    \"assets\": {
        \"bucket\": \"$BUCKET_NAME\",
        \"keys\": {
           \"$CHECKSUM\" : \"$SUBSCRIBER_PREFIX/$FILE\"
        }
    },
    \"eventID\": \"1b0c5952-91c6-498d-bf5f-95c250920d8b\",
    \"eventType\": \"ApplicationEvent\",
    \"subscriberCannonicalAccountId\": \"$SUBSCRIBER_CANNONICAL_ID\"}',EventBusName=$EVENT_BUS_NAME"

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
aws s3api put-object --bucket $BUCKET_NAME --key $FILE_NAME  --body /tmp/$FILE_NAME   --server-side-encryption aws:kms --ssekms-key-id $KMS_KEY_ID --grant-read id=$SUBSCRIBER_CANNONICAL_ID

rm -rf /tmp/$FILE_NAME

echo getting list of objects
aws s3api list-objects-v2 --bucket $BUCKET_NAME --fetch-owner

echo assuming cross account role in media exchange
resp=$(aws sts assume-role --role-arn $PUBLISHER_ROLE_ARN --role-session-name $SESSION_NAME)

export AWS_ACCESS_KEY_ID=$(echo $resp | jq -r .Credentials.AccessKeyId)
export AWS_SECRET_ACCESS_KEY=$(echo $resp | jq -r .Credentials.SecretAccessKey)
export AWS_SESSION_TOKEN=$(echo $resp | jq -r .Credentials.SessionToken)

echo caller identity is $(aws sts get-caller-identity --query Arn)

echo sending notification

aws --region $AWS_REGION events put-events --entries "Source=publisher.mxc.amazonaws.com,DetailType='source=ApplicationEvent,subscribername=${SUBSCRIBER_NAME}',Detail='{
    \"eventSource\": \"publisher.mxc.amazonaws.com\",
    \"eventName\": \"AssetsShared\",
    \"awsRegion\": \"$AWS_REGION\",
    \"userAgent\": \"GNU bash, version 3.2.57(1)-release (x86_64-apple-darwin18)\",
    \"assets\": {
        \"bucket\": \"$BUCKET_NAME\",
        \"keys\": {
           \"$CHECKSUM\" : \"$FILE_NAME\"
        }
    },
    \"eventID\": \"1b0c5952-91c6-498d-bf5f-95c250920d8b\",
    \"eventType\": \"ApplicationEvent\"}',EventBusName=$EVENT_BUS_NAME"

#! /bin/bash

## set access keys, profile etc. -

# export AWS_ACCESS_KEY_ID=
# export AWS_SECRET_ACCESS_KEY=
# export AWS_SESSION_TOKEN=
# export AWS_REGION=

##

echo caller identity is $(aws sts get-caller-identity --query Arn)

source ./common.env
source ./subscriber.env

aws s3api get-object --bucket $BUCKET_NAME --key $SUBSCRIBER_PREFIX/$FILE_NAME /tmp/$FILE_NAME

echo checksum is $(openssl dgst -sha256 /tmp/$FILE_NAME | cut -d' ' -f2)

rm -rf /tmp/$FILE_NAME

### list
echo assuming cross account role in media exchange
resp=$(aws sts assume-role --role-arn $SUBSCRIBER_ROLE_ARN --role-session-name $SESSION_NAME)

export AWS_ACCESS_KEY_ID=$(echo $resp | jq -r .Credentials.AccessKeyId)
export AWS_SECRET_ACCESS_KEY=$(echo $resp | jq -r .Credentials.SecretAccessKey)
export AWS_SESSION_TOKEN=$(echo $resp | jq -r .Credentials.SessionToken)

echo caller identity is $(aws sts get-caller-identity --query Arn)

echo getting list of objects
aws s3api list-objects-v2 --bucket $BUCKET_NAME --prefix $SUBSCRIBER_PREFIX --fetch-owner

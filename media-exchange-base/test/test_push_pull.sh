#!/bin/bash -e

source ./env.d/common.env
source ./env.d/publisher.env
source ./env.d/subscriber.env

FILE_NAME=media-exchange-test-object
SESSION_NAME=mxc-test-session
ROLE_NAME=mediaexchange-test-role

echo generating a 1MB file
dd if=/dev/urandom of=/tmp/$FILE_NAME count=1024 bs=1024 2>/dev/null
CHECKSUM=$(openssl dgst -sha256 /tmp/$FILE_NAME | cut -d' ' -f2)
echo checksum is $CHECKSUM

echo caller identity is $(aws sts get-caller-identity --query Arn)

AWS_ACCESS_KEY_ID_O=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY_O=$AWS_SECRET_ACCESS_KEY
AWS_SESSION_TOKEN_O=$AWS_SESSION_TOKEN

echo assuming cross account role in publisher account
resp=$(aws sts assume-role --role-arn arn:aws:iam::$PUBLISHER_ACCOUNT_ID:role/$ROLE_NAME --role-session-name $SESSION_NAME)

export AWS_ACCESS_KEY_ID=$(echo $resp | jq -r .Credentials.AccessKeyId)
export AWS_SECRET_ACCESS_KEY=$(echo $resp | jq -r .Credentials.SecretAccessKey)
export AWS_SESSION_TOKEN=$(echo $resp | jq -r .Credentials.SessionToken)

echo caller identity is $(aws sts get-caller-identity --query Arn)

echo copying to s3
aws s3api put-object --bucket $BUCKET_NAME --key $FILE_NAME  --body /tmp/$FILE_NAME  --server-side-encryption aws:kms --ssekms-key-id $KMS_KEY_ID --grant-read id=$SUBSCRIBER_CANONICAL_ACCOUNT_ID > /dev/null

export AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID_O
export AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY_O
export AWS_SESSION_TOKEN=$AWS_SESSION_TOKEN_O

echo assuming cross account role in subscriber account
resp=$(aws sts assume-role --role-arn arn:aws:iam::$SUBSCRIBER_ACCOUNT_ID:role/$ROLE_NAME --role-session-name $SESSION_NAME)

export AWS_ACCESS_KEY_ID=$(echo $resp | jq -r .Credentials.AccessKeyId)
export AWS_SECRET_ACCESS_KEY=$(echo $resp | jq -r .Credentials.SecretAccessKey)
export AWS_SESSION_TOKEN=$(echo $resp | jq -r .Credentials.SessionToken)

echo caller identity is $(aws sts get-caller-identity --query Arn)

##pull content
echo copying from s3
aws s3api get-object --bucket $BUCKET_NAME --key $FILE_NAME /tmp/$FILE_NAME >/dev/null
CHECKSUM2=$(openssl dgst -sha256 /tmp/$FILE_NAME | cut -d' ' -f2)

echo checksum is $CHECKSUM2

export AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID_O
export AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY_O
export AWS_SESSION_TOKEN=$AWS_SESSION_TOKEN_O


if [[ "$CHECKSUM" == "$CHECKSUM2" ]]; then
    echo "PASSED: checksums are equal"
else
    echo "FAILED: ****checksums are not equal"
    exit 1
fi

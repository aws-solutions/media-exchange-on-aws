#! /bin/bash 

FILE_NAME=mxc-test-file
TEST_SESSION_NAME=mxc-test-session

source ../tools/publisher.env

echo caller identity is $(aws sts get-caller-identity --query Arn)


AWS_ACCESS_KEY_ID_ORIG=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY_ORIG=$AWS_SECRET_ACCESS_KEY
AWS_SESSION_TOKEN_ORIG=$AWS_SESSION_TOKEN

TEST_ROLE_ARN="arn:aws:iam::$ACCOUNTID:role/mxc-test-role"

echo assuming cross account role in publisher account
resp=$(aws sts assume-role --role-arn $TEST_ROLE_ARN --role-session-name $TEST_SESSION_NAME)

export AWS_ACCESS_KEY_ID=$(echo $resp | jq -r .Credentials.AccessKeyId)
export AWS_SECRET_ACCESS_KEY=$(echo $resp | jq -r .Credentials.SecretAccessKey)
export AWS_SESSION_TOKEN=$(echo $resp | jq -r .Credentials.SessionToken)

echo caller identity is $(aws sts get-caller-identity --query Arn)

AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID_ORIG
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY_ORIG
AWS_SESSION_TOKEN=$AWS_SESSION_TOKEN_ORIG

echo generating a 1MB file
dd if=/dev/random of=/tmp/$FILE_NAME count=1024 bs=1024 2>/dev/null
CHECKSUM=$(openssl dgst -sha256 /tmp/$FILE_NAME | cut -d' ' -f2)
echo checksum is $CHECKSUM

echo copying test file to s3
# aws s3api put-object --bucket $BUCKET_NAME --key $SUBSCRIBER_PREFIX/$FILE_NAME  --body /tmp/$FILE_NAME  --server-side-encryption aws:kms --ssekms-key-id $KMS_KEY_ID --grant-read id=$SUBSCRIBER_CANNONICAL_ID

aws s3api put-object --bucket $BUCKET_NAME --key $SUBSCRIBER_PREFIX/$FILE_NAME  --body /tmp/$FILE_NAME  --grant-read id=$SUBSCRIBER_CANNONICAL_ID

rm -rf /tmp/$FILE_NAME


source ../tools/subscriber.env

echo caller identity is $(aws sts get-caller-identity --query Arn)


TEST_ROLE_ARN="arn:aws:iam::$ACCOUNTID:role/mxc-test-role"

echo assuming cross account role in subscriber account
resp=$(aws sts assume-role --role-arn $TEST_ROLE_ARN --role-session-name $TEST_SESSION_NAME)

export AWS_ACCESS_KEY_ID=$(echo $resp | jq -r .Credentials.AccessKeyId)
export AWS_SECRET_ACCESS_KEY=$(echo $resp | jq -r .Credentials.SecretAccessKey)
export AWS_SESSION_TOKEN=$(echo $resp | jq -r .Credentials.SessionToken)

echo caller identity is $(aws sts get-caller-identity --query Arn)

aws s3api get-object --bucket $BUCKET_NAME --key $SUBSCRIBER_PREFIX/$FILE_NAME /tmp/$FILE_NAME

CHECKSUM_N=$(openssl dgst -sha256 /tmp/$FILE_NAME | cut -d' ' -f2)
echo checksum is $CHECKSUM_N

rm -rf /tmp/$FILE_NAME

AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID_ORIG
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY_ORIG
AWS_SESSION_TOKEN=$AWS_SESSION_TOKEN_ORIG

# ### list
# echo assuming cross account role in media exchange
# resp=$(aws sts assume-role --role-arn $SUBSCRIBER_ROLE_ARN --role-session-name $SESSION_NAME)
#
# export AWS_ACCESS_KEY_ID=$(echo $resp | jq -r .Credentials.AccessKeyId)
# export AWS_SECRET_ACCESS_KEY=$(echo $resp | jq -r .Credentials.SecretAccessKey)
# export AWS_SESSION_TOKEN=$(echo $resp | jq -r .Credentials.SessionToken)
#
# echo caller identity is $(aws sts get-caller-identity --query Arn)
#
# echo getting list of objects
# aws s3api list-objects-v2 --bucket $BUCKET_NAME --prefix $SUBSCRIBER_PREFIX --fetch-owner

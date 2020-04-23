#! /bin/bash

## set access keys, profile etc. -

# export AWS_ACCESS_KEY_ID=
# export AWS_SECRET_ACCESS_KEY=
# export AWS_SESSION_TOKEN=
# export AWS_REGION=

##
EXTERNAL_ID="prodey+consumer@amazon.com"
MEDIA_EXCHNAGE_BUCKET_NAME="mxc-publisher-us-east-2-dev-latest-702582666339"

echo caller identity is $(aws sts get-caller-identity --query Arn)

echo copying from exchange
ORDER_ID='ORD-245778'
PREFIX='1-1'
FILE_NAME='media-file.mp4'

aws s3api get-object --bucket $MEDIA_EXCHNAGE_BUCKET_NAME --key $PREFIX/$ORDER_ID/$FILE_NAME /tmp/media-file.mp4

echo checksum is $(openssl dgst -sha256 /tmp/media-file.mp4 | cut -d' ' -f2)

rm -rf /tmp/media-file.mp4



### list 
SUBSCRIBER_EXTERNAL_ID="prodey+subscriber@amazon.com"
MXC_ROLE_ARN="arn:aws:iam::472352166085:role/mxc-subscriber-1-dev-stack-CrossAccountRole-1CP7GGLSBFOY7"
SESSION_NAME="mxc-read-session"

echo assuming cross account role in media exchange
resp=$(aws sts assume-role --role-arn $MXC_ROLE_ARN --role-session-name $SESSION_NAME --external-id $SUBSCRIBER_EXTERNAL_ID)

export AWS_ACCESS_KEY_ID=$(echo $resp | jq -r .Credentials.AccessKeyId)
export AWS_SECRET_ACCESS_KEY=$(echo $resp | jq -r .Credentials.SecretAccessKey)
export AWS_SESSION_TOKEN=$(echo $resp | jq -r .Credentials.SessionToken)

echo caller identity is $(aws sts get-caller-identity --query Arn)

echo getting list of objects
aws s3api list-objects-v2 --bucket $MEDIA_EXCHNAGE_BUCKET_NAME --prefix $PREFIX --fetch-owner



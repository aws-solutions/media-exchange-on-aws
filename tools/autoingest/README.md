# AutoIngest

This is a utility to automatically copy assets from MediaExchange bucket to another bucket in subscriber account. A lambda function is hooked up to the SNS notification through a buffering SQS queue. This lambda copies the object specified in the notification to another bucket. The lambda itself uses multipart copy, so even for a large file the 900s timeout should be good for 4-5TB objects.


## Getting Started
It is deployed on subscriber's account.

## Prerequisites
* GNU make
* Install docker desktop
* Install and configure [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html)
* Install [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)


### Install
* Initialize a shell with the necessary credentials to deploy to target (publisher / subscriber) account. You can do this by adding AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_SESSION_TOKEN as environment variables or by selecting the appropriate profile by adding AWS_PROFILE environment variable.
* Deploy AutoIngest
  * At the command prompt type `make install`.
  * follow the on-screen instructions for configuration parameters.
    * Specify the Source bucket name.
    * Specify the destination bucket name.
    * Specify the SNS topic Arn from subscriber on boarding summary.
    * Specify the destination bucket prefix.


### Pricing

1. S3 API pricing for GET / PUT. See [here](https://aws.amazon.com/s3/pricing/).
1. There is no cost for egress in the same region.
1. AWS Lambda pricing. See [here](https://aws.amazon.com/lambda/pricing/)


### Cleanup

* Initialize a shell with the necessary credentials to the account where you have deployed this. You can do this by adding AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_SESSION_TOKEN as environment variables or by selecting the appropriate profile by adding AWS_PROFILE environment variable.
* Navigate to MediaExchnageOnAWS/tools/autoingest directory.
* At the command prompt type `make clean`.

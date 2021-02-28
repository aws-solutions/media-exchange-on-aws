# MediaSync

There are a number of tools that one can use to move files between S3 buckets. This includes S3 API, SDK, CLI and higher level services like S3 batch. However, it is non-trivial to move large (100s of GBs) files, thousands of files or (worse) thousands of large files using these tools. MediaSync helps mitigate that challenge. It scales to thousands of files. It can handle file sizes upto 5TB. It is resilient and cost effective. It runs multiple transfers in parallel and can be configured to achieve very high per file throughput.

This can also be used for cross region transfers.  

If MediaSync is being used in conjunction with MediaExchange (not an absolute requirement), it can encapsulate publisher and subscriber configuration(s) at the deployment time.


## Getting Started
It is deployed on publisher or subscriber's account. It is configured slightly differently for publishers and subscriber workflows.

## Prerequisites
* GNU make
* Install docker desktop
* Install and configure [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html)
* Install [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)


### Install
* Initialize a shell with the necessary credentials to deploy to target (publisher / subscriber) account. You can do this by adding AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_SESSION_TOKEN as environment variables or by selecting the appropriate profile by adding AWS_PROFILE environment variable.
* (optional) Build and publish custom container
  * At the command prompt type `make publish`. This publishes the custom container to a private ECR repository.
  * follow the on-screen instructions for configuration parameters.
* Deploy MediaSync
  * At the command prompt type `make install`.
  * follow the on-screen instructions for configuration parameters.
    * If you have built a custom image in the previous step, specify that in the ImageName parameter. Otherwise leave default as amazon/aws-cli.
    * Select mode as Push if deploying for publisher. It requires you to specify subscriber cannoical user id.
    * Select mode as Pull if deploying for subscriber.
    * Specify the destination bucket name.

### Copying Media Assets between S3 buckets.

MediaSync uses S3 batch operations as frontend. S3 Batch operations works with a CSV formatted inventory list file. You can use s3 [inventory reports](https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-inventory.html) if you already have one. Otherwise, you can generate an inventory list by utilizing the included scripts/generate_inventory.sh script. Please note that the script works for hundreds of files. If you have thousands of objects in the bucket, inventory reports are the way to go.

S3 Batch Jobs invoke a lambda function that performs a few basic checks before handing off the actual copy operation to a script. This script runs in containers in AWS Batch and Fargate. The copy operation itself uses S3 server side copy, so the containers themselves do not handle the actual bytes. If the object is small (<500MB) the copy happens in lambda. This model takes advantage of the low cost SPOT pricing in FARGATE. And mitigates the potential duration limits in lambda. As an example, a 1TB object takes ~8 minutes to move, a 5TB object takes ~35 minutes.

S3 Batch Jobs works like an orchestrator. The lambdas not only ensures the basic permission checks but also works as a protection mechanism for S3 throttles.

#### Performance (S3->S3 same region) 

* 24 seconds for 1 GB
* 32 seconds for 5 GB
* 40 seconds for 10 GB
* 2 minute for 100 GB
* 7 minutes 30 seconds for 500 GB
* 11 minutes for 1TB
* 27 minutes for 5TB


#### Start a Transfer

1. Login into AWS account and navigate to S3.
1. Click on batch operations on the left menu.
1. Click Create Job
  1. Select the region where you have installed the mediasync.
  1. For the manifest, select CSV or S3 inventory report based on what you prepared.
  1. click next
  1. Select "invoke AWS lambda function"
  1. In the section below, select "Choose from functions in your account" and select the lambda function ending with _mediasync_copier_.
  1. click next
  1. In the "Additional options" section, enter an appropriate description.
  1. For the completion report, select failed tasks only and select a destination s3 bucket.
  1. Under the permissions section, select choose from existing IAM roles, and select the IAM role ending in _mediasync_copier_role_ in the same region.
  1. click next
  1. Review the Job in the last page and click create job.
1. Once the Job is created, it goes from new to awaiting user confirmation state. Click on run job when ready.
1. The S3 Batch job invokes the lambda function that drops copy jobs into an ECS batch job queue. Tasks from this queue are executed in FARGATE.  

#### Verify

1. Check if the S3 Batch Job was complete.
1. Check if there are any pending jobs in the JobQueue and if all the Jobs were successful.
1. Once you have verified that the job was successful, check the destination S3 buckets.


### Pricing

1. S3 API pricing for GET / PUT. See [here](https://aws.amazon.com/s3/pricing/).
1. S3 Batch pricing See [here](https://aws.amazon.com/s3/pricing/)
1. There is no cost for egress in the same region.
1. There is no additional charge for AWS Batch.
1. AWS Lambda pricing. See [here](https://aws.amazon.com/lambda/pricing/)
1. AWS Fargate SPOT pricing. See [here](https://aws.amazon.com/fargate/pricing/)

# Fixity

AWS customers often need to compute checksums for the objects in S3. This is often required by contractual agreements i.e the customers deliver checksums alongside the file deliverables. The media and entertainment industry has been using MD5, SHA1 and more recently XXHASH. A common problem with the commonly used algorithms (MD* and SHA*) is that they can not be parallelized effectively in a distributed compute environment. Thereby they have to be computed serially by sequentially reading the file/object from S3.

If you have a need to calculate checksums on a large number of objects, AWS infrastructure can be used to compute them in parallel. This utility helps you run checksums at scale by running them in parallel. It uses AWS Batch / AWS FARGATE to orchestrate the container infrastructure. There are no servers to manage.  

By default, this utility is optimized for cost /GB. You can configure it to go faster by upsizing resources allocated to each container.

## Architecture
This utility reads the objects directly from S3 and computes md5, sha1, xxhash and xx64hash. The resultant checksums are stored as tags on the source S3 objects. This process is executed in containers managed by AWS Batch on Fargate. The fargate cluster is configured to use SPOT instances. The parallelization

## Getting Started
It can be deployed on any AWS account. There is no direct dependency on MediaExchange.

## Prerequisites
* GNU make
* Install docker desktop
* Install and configure [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html)
* Install [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)

### Install
* Initialize a shell with the necessary credentials to deploy to target account. You can do this by adding AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_SESSION_TOKEN as environment variables or by selecting the appropriate profile by adding AWS_PROFILE environment variable.
* Deploy Fixity
  * At the command prompt type `make install`.
  * follow the on-screen instructions for configuration parameters.

### Calculate checksums of Media Assets in S3 buckets.

It uses S3 batch operations as frontend. S3 Batch operations works with a CSV formatted inventory list file. You can use s3 [inventory reports](https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-inventory.html) if you already have one. Otherwise, you can generate an inventory list by utilizing the included scripts/generate_inventory.sh script. Please note that the script works for hundreds of files. If you have thousands of objects in the bucket, inventory reports are the way to go.

S3 Batch Jobs invoke a lambda function that performs a few basic checks before handing off the actual fixity operation to a script. This script runs in containers in AWS Batch and Fargate for files smaller than 10GB. If the files are larger than 10GB it runs on Ec2 SPOT which opens up use of high performance and larger instance types. It produces the following checksums, as store them as custom tags with the s3 objects.

* md5sum
* sha1sum
* xxhsum

(as per [MHL](https://mediahashlist.org/) recommendations)

S3 Batch Jobs works like an orchestrator. The lambdas not only ensures the basic permission checks but also works as a protection mechanism for S3 throttles.

#### Performance

* 40 seconds for 1 GB (on smallest FARGATE compute resource)
* 2 minutes for 5 GB (^)
* 3 minutes 40 seconds for 10 GB (^)
* 2 minutes for 50 GB (on 16 vCPU on EC2 SPOT)  
* 19 minutes for 500 GB (^)
* 38 minutes for 1TB (^)
* 2 hours and 50 minutes for 5TB (^)

An even bigger instance type does not yield to better performance, mainly due to the limitations of the hashing algorithms. These numbers are ~80% of the theoretical maximum on the respective CPU types.

#### Start

1. Login into AWS account and navigate to S3.
1. Click on batch operations on the left menu.
1. Click Create Job
  1. Select the region where you have installed the fixity.
  1. For the manifest, select CSV or S3 inventory report based on what you prepared.
  1. click next
  1. Select "invoke AWS lambda function"
  1. In the section below, select "Choose from functions in your account" and select the lambda function ending with _fixity_.
  1. click next
  1. In the "Additional options" section, enter an appropriate description.
  1. For the completion report, select failed tasks only and select a destination s3 bucket.
  1. Under the permissions section, select choose from existing IAM roles, and select the IAM role ending in _fixity_role_ in the same region.
  1. click next
  1. Review the Job in the last page and click create job.
1. Once the Job is created, it goes from new to awaiting user confirmation state. Click on run job when ready.
1. The S3 Batch job invokes the lambda function that drops copy jobs into an ECS batch job queue. Tasks from this queue are executed in FARGATE.  

#### Verify

1. Check if the S3 Batch Job was complete.
1. Check if there are any pending jobs in the JobQueue and if all the Jobs were successful.
1. Once you have verified that the job was successful, look for the checksum tags for the objects in S3 bucket.


### Pricing

1. S3 API pricing for GET / PUT. See [here](https://aws.amazon.com/s3/pricing/).
1. S3 Batch pricing See [here](https://aws.amazon.com/s3/pricing/)
1. There is no cost for egress in the same region.
1. There is no additional charge for AWS Batch.
1. AWS Lambda pricing. See [here](https://aws.amazon.com/lambda/pricing/)
1. AWS Fargate SPOT pricing. See [here](https://aws.amazon.com/fargate/pricing/)


### Cleanup

* Initialize a shell with the necessary credentials to the account where you have deployed this. You can do this by adding AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_SESSION_TOKEN as environment variables or by selecting the appropriate profile by adding AWS_PROFILE environment variable.

* Navigate to MediaExchnageOnAWS/tools/fixity directory.
* At the command prompt type `make clean`.
* This process leaves a VPC Flow Log Bucket. This bucket needs to be cleaned up manually.
  * Find the bucket name(s) with the following command.
  ```
  $ aws s3 ls | grep -i mediaexchange-tools-fixity-
  ```
  * for each of these bucket names, run the following command.
  ```
  $ aws s3 rm s3://<bucket name> --recursive
  $ aws s3 rb s3://<bucket name>
  ```

# Managed-transfer

There are a number of tools that one can use to move files between S3 buckets. This includes S3 API, SDK, CLI and higher level services like S3 batch. However, it is a non-trivial to move large (100s of GBs) files, thousands of files or worse thousands of large files using existing tools. Managed transfer tool, when used in conjunction with MediaExchange, helps mitigate that challenge. It moves files by running containers on EC2 SPOT. It is resilient and  cost effective. Is is configured for high throughput S3 server side transfers and can reach 2GB/s per object. It can be used for cross region transfers as well (cross region transfer fees apply).

There is also an option to generate CheckSums while the Objects are being copied. The resultant checksums are saved as  metadata at the destination. By default it computes md5, and sha256 checksums (can be easily extended to add sha512 etc.). However, please keep in mind that checksum calculations are CPU bound, operating at 100MB/s in the defult configuration.

This can be used equally by publishers and subscribers. There are two frontend integrations available out of the box (a) a shell script based interface that can be used for moving one file at a time. and (b) a S3 batch integration that can be used to move hundreds and thousands of files. The frontend for S3 Batch also encapsulates the configuration parameters for a specific publisher-subscriber relationship for a publisher. So, if you are delivering assets to multiple subscribers/publishers, you would have to deploy a separate frontend for each.

This tool can also be used for cross region transfers. If you are aggregating content from multiple providers, this tool can help you copy the assets from multiple provider's mediaexchange buckets at the same time.  

## Install

It is configured slightly differently for publishers and subscribers.

### Publisher

```code
export AWS_REGION=<aws region>
export CFN_BUCKET=<a s3 bucket in the same region to store deployment artifacts>
export MEDIAEXCHANGE_BUCKET_NAME=<MediaExchange bucket name from the on-boarding summary>
export KMS_KEY_ID=<.. from the onboarding summary>
export SUBSCRIBER_CANONICAL_ACCOUNT_ID=< .. from on-boarding summary >

make package install publisherhelper
```

### Subscriber

```code
export AWS_REGION=<aws region>
export CFN_BUCKET=<a s3 bucket in the same region to store deployment artifacts>
export DESTINATION_BUCKET_NAME=<a s3 bucket where the assets will be copied to>

make package install subscriberhelper
```

### CheckSums

To calculate the checksums during the copy process, deploy with `export CHECKSUM=true`. The checksums are saved as Object metadata in S3 `content-md5: xxxx` and  `content-sha256: xxxx` etc.

### Using S3 Batch Jobs

#### Prepare
The S3 Batch operations works with a CSV formatted inventory list file. You can use s3 inventory reports and optionally, you can generate an inventory list by utilizing the included generate_inventory.sh script.

#### Run a Transfer

1. Login into Publisher/Subscriber account and navigate to S3.
1. Click on batch operations on the left menu.
1. Click Create Job
  1. Select the region where you have installed the managed transfer utility.
  1. For the manifest, select CSV or S3 inventory report based on what you prepared.
  1. click next
  1. Select "invoke AWS lambda function"
  1. In the section below, select "Choose from functions in your account" and select the lambda function ending with _s3job-publisher-driver_ or _s3job-subscriber-driver_ in the same region.
  1. click next
  1. In the "Additional options" section, enter an appropriate description.
  1. For the completion report, select failed tasks only and select a destination s3 bucket.
  1. Under the permissions section, select choose from existing IAM roles, and select the IAM role ending in _s3job-publisher-role_ or _s3job-subscriber-role_
  1. click next
  1. Review the Job in the last page and click create job.
1. Once the Job is created, it goes from new to awaiting user confirmation .. state. Click on run job when ready.
1. The S3 Batch job invokes the lambda function that drops copy jobs into an ECS/AWS batch job queue. Tasks from this queue are executed in a fleet of spot instances.  

#### Verify

1. Check if the S3 Batch Job was complete. If there were any failures, it will create a failed job report with errors in the location you specified in the configuration. P
1. Check if there are any pending jobs in the JobQueue and if all the Jobs were successful. Of any of the tasks failed, you can navigate to the details page and there is a link to the cloudwatch log stream where job outputs are saved.
1. Optionally you can check the EC2 spot fleet section to see how many instances were created and how long they were used for.
1. Once you have verified that the job was successful, check the destination S3 buckets.

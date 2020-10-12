# S3 batch transfer

There are a number of tools that one can use to move files between S3 buckets. This includes S3 API, SDK, CLI and higher level services like S3 batch. However, it is a non-trivial to move large (100s of GBs) files, thousands of files or worse thousands of large files using existing tools. S3 batch transfer tool, when used in conjunction with MediaExchange, helps mitigate that challenge. It moves files by running containers on EC2 SPOT. It is resilient and  cost effective. Is is configured for high throughput S3 server side transfers and can reach 2GB/s per object. It can be used for cross region transfers as well (cross region transfer fees apply).

This can be used equally by publishers and subscribers. The S3 Batch also encapsulates the configuration parameters for a specific publisher-subscriber relationship for a publisher. So, if you are delivering assets to multiple subscribers/publishers, you would have to deploy a separate frontend for each.

This tool can also be used for cross region transfers. If you are aggregating content from multiple providers, this tool can help you copy the assets from multiple provider's mediaexchange buckets at the same time.  

## Install
It is configured slightly differently for publishers and subscribers.

## Dependencies
The install requires awscli, aws sam cli and docker on the deployment machine.

### Publisher
* Initialize a shell with the necessary credentials to deploy to publisher account. You can do this by adding AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_SESSION_TOKEN as environment variables or by selecting the appropriate profile by adding AWS_PROFILE environment variable.
* At the command prompt type `make install publisherhelper-stack`
* follow the on-screen instructions for configuration parameters.

### Subscriber
* Initialize a shell with the necessary credentials to deploy to publisher account. You can do this by adding AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_SESSION_TOKEN as environment variables or by selecting the appropriate profile by adding AWS_PROFILE environment variable.
* At the command prompt type `make install subscriber-stack`
* follow the on-screen instructions for configuration parameters.

### Using S3 Batch Jobs

#### Prepare
The S3 Batch operations works with a CSV formatted inventory list file. You can use s3 inventory reports and optionally, you can generate an inventory list by utilizing the included scripts/generate_inventory.sh script.

#### Run a Transfer

1. Login into Publisher/Subscriber account and navigate to S3.
1. Click on batch operations on the left menu.
1. Click Create Job
  1. Select the region where you have installed the managed transfer utility.
  1. For the manifest, select CSV or S3 inventory report based on what you prepared.
  1. click next
  1. Select "invoke AWS lambda function"
  1. In the section below, select "Choose from functions in your account" and select the lambda function ending with _s3batch-publisher-driver_ or _s3batch-subscriber-driver_ in the same region.
  1. click next
  1. In the "Additional options" section, enter an appropriate description.
  1. For the completion report, select failed tasks only and select a destination s3 bucket.
  1. Under the permissions section, select choose from existing IAM roles, and select the IAM role ending in _s3batch-publisher-role_ or _s3batch-subscriber-role_
  1. click next
  1. Review the Job in the last page and click create job.
1. Once the Job is created, it goes from new to awaiting user confirmation .. state. Click on run job when ready.
1. The S3 Batch job invokes the lambda function that drops copy jobs into an ECS/AWS batch job queue. Tasks from this queue are executed in a fleet of spot instances.  

#### Verify

1. Check if the S3 Batch Job was complete. If there were any failures, it will create a failed job report with errors in the location you specified in the configuration. P
1. Check if there are any pending jobs in the JobQueue and if all the Jobs were successful. Of any of the tasks failed, you can navigate to the details page and there is a link to the cloudwatch log stream where job outputs are saved.
1. Optionally you can check the EC2 spot fleet section to see how many instances were created and how long they were used for.
1. Once you have verified that the job was successful, check the destination S3 buckets.

# Managed-transfer

There are a number of tools that one can use to move files between S3 buckets. This includes S3 API, SDK, CLI and higher level services like S3 batch. However, it is a non-trivial to move large (100s of GBs) files, thousands of files or worse thousands of large files using existing tools. Managed transfer tool, when used in conjunction with MediaExchange, helps mitigate that challenge. It moves files by running containers on EC2 SPOT. It is resilient and  cost effective. Is is configured for high throughput S3 server side transfers and can reach 2GB/s per object. It can be used for cross region transfers as well (cross region transfer fees apply).

There is also an option to generate CheckSums while the Objects are being copied. The resultant checksums are saved as  metadata at the destination. By default it computes md5, and sha256 checksums (can be easily extended to add sha512 etc.). However, please keep in mind that checksum calculations are CPU bound, operating at 100MB/s in the defult configuration.

This can be used equally by publishers and subscribers. There are two frontend integrations available out of the box (a) a shell script based interface that can be used for moving one file at a time. and (b) a S3 batch integration that can be used to move hundreds and thousands of files. These frontends also encapsulate the configuration parameters for a specific publisher-subscriber relationship. So, if you are delivering/receiving assets to/from multiple subscribers/publishers, you would have to deploy a separate frontend for each.

## Install

It is configured slightly differently for publishers and subscribers. This tool can also be used for cross region transfers.

### Publisher

```code
export AWS_REGION=<aws region>
export CFN_BUCKET=<a s3 bucket in the same region to store deploymemt artifacts>
export MEDIAEXCHANGE_BUCKET_NAME=<MediaExchange bucket name from the onboarding summary>
export KMS_KEY_ID=<.. from the onboarding summary>
export SUBSCRIBER_CANONICAL_ACCOUNT_ID=< .. from onboarding summary >

make package install publisherhelper
```

### Subscriber

```code
export AWS_REGION=<aws region>
export CFN_BUCKET=<a s3 bucket in the same region to store deploymemt artifacts>
export DESTINATION_BUCKET_NAME=<a s3 bucket where the assets will be copied to>

make package install subscriberhelper
```

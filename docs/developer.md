## Developer Guide

### Prerequisites

* GNU make
* Install docker desktop
* Install and configure [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html)
* Install [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)

### Install

* Initialize a shell with the necessary credentials to deploy to mediaexchange account. You can do this by adding AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_SESSION_TOKEN as environment variables or by selecting the appropriate profile by adding AWS_PROFILE environment variable.
* At the command prompt type `make install`.
* Follow the on-screen instructions for configuration parameters.

![install](images/install.gif)


### Setup a publisher, subscriber and transfer agreement

* After install, at the command prompt type `make provision`.
* Follow the on-screen instructions for configuration parameters.
Note: Service Catalog interface is the preferred way of on-boarding.

![provision](images/provision.gif)

### Developer mode

This method bypasses the service catalog setup to deploy a single publisher, subscriber and mediaexchange.

* Initialize a shell with the necessary credentials for publisher account. You can do this by adding AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_SESSION_TOKEN as environment variables or by selecting the appropriate profile by adding AWS_PROFILE environment variable.
  1. Navigate to MediaExchnageOnAWS (root) directory.
  1. `make testrole-stack`
  1. Enter the mediaexchange ACCOUNT_ID for parameter TestAccountId.
  1. Enter 'n' for "Save arguments to configuration file" (Y/n)

* Initialize a shell with the necessary credentials for subscriber account.
  1. Navigate to MediaExchnageOnAWS (root) directory.
  1. `make testrole-stack`
  1. Enter the mediaexchange ACCOUNT_ID for parameter TestAccountId.
  1. Enter 'n' for "Save arguments to configuration file" (Y/n)

* Initialize a shell with the necessary credentials for MediaExchange account.
  1. Navigate to MediaExchnageOnAWS (root) directory.
  1. `make quickstart`
  1. Follow the instructions to provide publisher and subscriber information. The default values are printed out for the mediaexchange account id.  

![Quickstart](images/quickstart.gif)


### Tests

The tests are run from the mediaexchange account. The test script assumes a role in the publisher and subscriber accounts to run the tests.

* Initialize a shell with the necessary credentials for MediaExchange account.
  1. Navigate to MediaExchnageOnAWS (root) directory.
  1. `make test`

## Usage
### Sharing assets
```
$ aws s3 cp <filename> s3://<bucket name>/ --grants read=id=<subscriber canonical user id>
```

### Receiving assets
```
$ aws s3 cp s3://<bucket name>/<object> <filename>
```


### Cleanup

* Initialize a shell with the necessary credentials for mediaexchange account. You can do this by adding AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_SESSION_TOKEN as environment variables or by selecting the appropriate profile by adding AWS_PROFILE environment variable.
* At the command prompt type `make clean`.
* Uninstall process retains certain s3 buckets. These bucket needs to be cleaned up manually.
  * Find the bucket name(s) with mediaexchange and delete their contents.
  * Versioned buckets that fail to delete from the command above, will require additional steps to cleanup. please see the instructions [here](https://docs.aws.amazon.com/AmazonS3/latest/userguide/RemDelMarker.html)
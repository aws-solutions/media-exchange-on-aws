## Table of contents

- [Customizing the Solution](#customizing-the-solution)
  - [Prerequisites](#prerequisites)
  - [Deploy](#deploy)
  - [Setup](#setup)
  - [Testing](#testing)
  - [Cleanup](#cleanup)
- [Usage](#usage)
- [Developer Mode](#developer-mode)

<a name="customizing-the-solution"></a>

# Customizing the Solution

<a name="prerequisites"></a>

## Prerequisites

- GNU make
- Docker desktop
- Node
- [AWS CDK] (https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html)
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html)
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)

<a name="deploy"></a>

## Deploy

- Initialize a shell with the necessary credentials to deploy to the MediaExchange account. You can do this by adding AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_SESSION_TOKEN as environment variables or by selecting the appropriate profile by adding AWS_PROFILE environment variable.
- At the command prompt type `make install`.
- Follow the on-screen instructions for configuration parameters.

<a name="setup"></a>

## Setup

- After install, at the command prompt type `make provision`.
- Follow the on-screen instructions for configuration parameters.
  Note: Service Catalog interface is the preferred way of on-boarding.

<a name="developer-mode"></a>

# Developer mode

This method bypasses the service catalog setup to deploy a single publisher, subscriber and transfer agreement.

- Initialize a shell with the necessary credentials for publisher account. You can do this by adding AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_SESSION_TOKEN as environment variables or by selecting the appropriate profile by adding AWS_PROFILE environment variable.

  1. Navigate to MediaExchnageOnAWS (root) directory.
  1. `make testrole-stack`
  1. Enter the MediaExchange ACCOUNT_ID for parameter TestAccountId.
  1. Enter 'n' for "Save arguments to configuration file" (Y/n)

- Initialize a shell with the necessary credentials for subscriber account.

  1. Navigate to MediaExchnageOnAWS (root) directory.
  1. `make testrole-stack`
  1. Enter the MediaExchange ACCOUNT_ID for parameter TestAccountId.
  1. Enter 'n' for "Save arguments to configuration file" (Y/n)

- Initialize a shell with the necessary credentials for MediaExchange account.
  1. Navigate to MediaExchnageOnAWS (root) directory.
  1. `make quickstart`
  1. Follow the instructions to provide publisher and subscriber information. The default values are printed out for the MediaExchange ACCOUNT_ID.

<a name="testing"></a>

## Testing

The tests are run from the MediaExchange account. The test script assumes a role in the publisher and subscriber accounts to run the tests.

- Initialize a shell with the necessary credentials for MediaExchange account.
  1. Navigate to MediaExchnageOnAWS (root) directory.
  1. `make test`

<a name="usage"></a>

# Usage

- Sharing assets

```
$ aws s3 cp <filename> s3://<bucket name>/
```

- Receiving assets

```
$ aws s3 cp s3://<bucket name>/<object> <filename>
```

<a name="cleanup"></a>

## Cleanup

- Initialize a shell with the necessary credentials for MediaExchange account. You can do this by adding AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_SESSION_TOKEN as environment variables or by selecting the appropriate profile by adding AWS_PROFILE environment variable.
- At the command prompt type `make clean`.
- Uninstall process retains certain S3 buckets. These bucket needs to be cleaned up manually.
  - Find the bucket name(s) with mediaexchange and delete their contents.
  - Versioned buckets that fail to delete from the command above, will require additional steps to cleanup. Please refer to the instructions [here](https://docs.aws.amazon.com/AmazonS3/latest/userguide/RemDelMarker.html).

# AutoIngest

## Table of contents

- [Solution Overview](#solution-overview)
- [Architecture Diagram](#architecture-diagram)
- [Customizing the Solution](#customizing-the-solution)
  - [Prerequisites for Customization](#prerequisites-for-customization)
  - [Deploy](#deploy)
  - [Cleanup](#cleanup)
- [Cost](#cost)
- [License](#license)

<a name="solution-overview"></a>
# Solution Overview
Subscribers to a MediaExchange bucket have the option to automatically ingest to their own bucket by using this component. It automatically moves assets from MediaExchange into a subscriber-owned S3 bucket. This optional component is deployed in the subscriber’s account.

<a name="architecture-diagram"></a>
# Architecture Diagram
![Architecture](images/autoingest.jpeg)

<a name="customizing-the-solution"></a>
## Customizing the Solution

<a name="prerequisites-for-customization"></a>
### Prerequisites for Customization
* GNU make
* Docker desktop
* [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html)
* [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)

<a name="deploy"></a>
### Deploy

* Initialize a shell with AWS credentials to deploy to target (subscriber) account. You can do this by adding AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_SESSION_TOKEN as environment variables or by selecting the appropriate profile by adding AWS_PROFILE environment variable.
* At the command prompt type `make install`.
* follow the on-screen instructions for configuration parameters.
  * Specify the Source bucket name.
  * Specify the destination bucket name.
  * Specify the SNS topic Arn from subscriber on boarding summary.
  * Specify the destination bucket prefix.

<a name="cleanup"></a>
### Cleanup

* Initialize a shell with AWS credentials to deploy to target (subscriber) account. You can do this by adding AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_SESSION_TOKEN as environment variables or by selecting the appropriate profile by adding AWS_PROFILE environment variable.
* At the command prompt type `make clean`.

<a name="cost"></a>
## Cost

* S3 API pricing for GET / PUT. See [here](https://aws.amazon.com/s3/pricing/).
* There is no cost for egress in the same region.
* AWS Lambda pricing. See [here](https://aws.amazon.com/lambda/pricing/)


<a name="license"></a>
# License
See license [here](https://github.com/aws-solutions/media-exchange-on-aws/blob/master/LICENSE.txt)

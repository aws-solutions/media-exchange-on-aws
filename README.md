## Media Exchange On AWS

Traditional file transfer services for Media supply chain are expensive, can add unnecessary hours to a workflow making quick-turn challenging, and not optimized for in-cloud media ecosystems. AWS Customers and ISV Partners can now take advantage of utilizing AWS as a common media storage foundation to create direct hand-offs within the ecosystem eliminating 3rd party delivery mechanisms and the associated time, cost and security concerns. This new Solution, called Media Exchange, AWS Customers and ISV Partners can ensure optimal quality, sustain a consistent understanding of the asset state and confirm asset receipt. The goal of this project is to re-examine media supply-chain with cloud-optimizations in mind, and define a MVP solution that can be deployed with CloudFormation templates. When the solution is deployed in a customer account, a de-facto exchange standard is established with other Media Exchange users.

## Current State  

The traditional file transfer model presents a few key challenges including (a) egress, transfer licensing and transfer costs add up (In case of managed offerings, a per gigabyte transfer cost), (b) content is potentially exposed to a security breach equated to the weakest link in the supply chain, (c) there is often lack of visibility to receipt verification, and (d) file corruption can happen during transfer creating file corruption issues to mitigate. Traditional file transfer services require that you manage a fleet of servers and agents to transfer assets. The sender and receiver must utilize the same software to be able to exchange assets. In a complex distribution model, your network of senders or receivers may use different software protocols requiring an investment on your side in multiple protocols to support multiple partners.  The establishment of a new transfer exchange between Publisher and Subscriber under the existing system can be time consuming and add layers of paperwork and approvals. Moreover, only some of the file transfer service
es offer a cloud-based offering that can deliver assets to object stores in cloud which helps with one-to-many transfers over the on-prem offerings. In today’s complex distribution model, staff must manage content egress, schedule transfers, send or monitor notifications and follow up for verification of receipt across different interfaces. AWS Media Exchange is Solution to address these problems.

## What is Media Exchange

The Media Exchange Solution puts a shared object store (S3 bucket) between publishers and subscribers in a separate, secure AWS account. The sender copies the assets into this shared storage area and creates permissions so that the receivers can pull the content from the S3 bucket. In this Solution, the publishers copy to the S3 bucket and the subscribers pull from there. The assets never leave the S3 data plane in this process, thereby (a) there are no per/GB data egress and transfer costs, (b) this eliminates that egress, schedule and delivery time dependencies, (c) is very fast and (d) there are no servers to manage. The assets are secure by default, encrypted at rest and in transit. Optionally, the assets are encrypted by keys managed by AWS Key Management Service. In the standard deployment model, Media Exchange is deployed in its own account. Assets are stored in this account only for the purposes for transfer and allows a very limited set of permissions to Publishers and Subscribers. Moreover, Media Exchange account works like a temporary custodian but does not have read/write permissions to the assets shared through it. Publishers and Subscribers are on-boarded with CloudFormation templates. Each publisher gets their own S3 bucket to share assets from and each subscriber gets a unique prefix (folder). The publishers share content by copying assets under these named prefixes. A subscriber can only view assets under their assigned prefix and import assets that are shared to them. Publishers and subscribers can only perform these operations from their respective AWS accounts that they have on-boarded with into Media Exchange. A primary benefit of this process is that there are no credentials to share between Publishers and Subscribers. All operations on the assets are tracked via AWS and S3 logs. The assets in the Media Exchange account are lifecycle deleted after a Publisher-defined period.
This is a seamless addition to the current workflow for your customers who use S3 as part of their Media Supply Chain. This Solution is a new offering that is a separate secure AWS account linked to your existing AWS Account. This Solution can also integrate with native AWS file transfer offerings like data sync, snow* devices to help transfer assets between physical locations for customers who do not currently integrate S3 into the media supply chain. You can use native AWS APIs and tools to move content across large geographical distances by leveraging AWS global infrastructure. decoupled transfer process is intrinsically more robust as the assets never leave the S3 data plane The quality risk is much lower in Media Exchange than having to transfer over the internet.

## Architecture

![](assets/Architecture.png)

## Supported Workflows
In a typical content owner workflow, the content owner or studio is onboarded as a publisher, and the MediaExchange is hosted by the distributor. The Distributor's MAM/DAM/Ingest service is onboarded as a subscriber to MediaExchange. In a content distributor workflow, the distributor is onboarded as a publisher to deliver assets to a partner (e.g. OTT service) and the subscriber is the downstream OTT service.

The subscriber pushes the assets and publishers pull the assets from MediaExchange. This push/pull model also enables simple setup and enforcement of both lifecycle policies and alignment with delivery SLAs.

## Requirements
You will need three AWS accounts to deploy this effectively (a) publisher, (b) subscriber and (c) MediaExchange. The CloudFormation templates are deployed in (c) MediaExchange account.

## Getting Started with MediaExchange On AWS

1. [Install](#)
1. [Add a publisher](#)
1. [Add a subscriber](#)
1. [Setup transfer agreement](#)
1. [Share assets](#)
1. [Receive assets](#)

### Install

#### (Option 1) Install with AWS SAM CLI

The easiest install path is to use the included Makefile. This method utilizes [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html) to package and install the included CloudFormation templates. If you do not have AWS SAM CLI installed, you can follow the alternative UI based install process described in the next section.

* Initialize a shell with the necessary credentials to deploy to MediaExchange account. You can do this by adding AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_SESSION_TOKEN as environment variables or by selecting the appropriate profile by adding AWS_PROFILE environment variable.
* At the command prompt type `make install`
* Once complete, it will print out a ConsoleUrl to launch ServiceCatalog portfolio manager. Please note that URL as you will be using that URL to add publishers and subscribers in the next step.

#### (Option 2) UI based Install with AWS console

* Login into MediaExchange account and navigate to S3.
* You will need to use a S3 Bucket for storing the packaged CloudFormation templates. Please create a bucket if needed. Make sure to select a region where you are planning to deploy MediaExchange.
* Create a folder structure for media-exchange-on-aws/v1.0.0/.
* Copy the template files (.yaml) under media-exchange-base/deployment/ to this folder.
* Navigate to services > CloudFormation. Note the region on the top right corner.
  1. Click on Create Stack.
  1. Select "Template is Ready" (default option) in prepare template section and select "Upload a template file" in the specify template section.
  1. Click "choose file" to select servicecatalog.yaml from media-exchange-base/deployment/ folder.
  1. Click next
  1. Enter a name of the stack eg. mediaexchange-core-prod.
  1. Enter the name of the bucket where CloudFormation templates were copied.
  1. Click next
  1. Accept the capabilities and transforms by checking the boxes and click on create stack.
  1. Wait for the the status to change to create_complete.
  1. Navigate to the outputs tab of the stack and make a note of the ConsoleUrl parameter. You will be using that URL to add publishers and subscribers in the next step.

### Add a publisher

1. Login into MediaExchange account using the ConsoleUrl to launch ServiceCatalog portfolio manager. This URL is available in the stack outputs section of the MediaExchange CloudFormation stack.
1. The page should list out three products from AWS Solutions Library. Use _publisher_ to onboard an account that can share assets through MediaExchange
1. Click on _publisher_ and then click launch product button.
1. Enter a product name eg. mediaexchange-publisher-studio.
1. Enter a name for publisher. This is used for identifying the publisher in the MediaExchange and will be used to link up to a subscriber.
1. Enter the AWS Account Id of the publisher account. See [here](https://docs.aws.amazon.com/IAM/latest/UserGuide/console_account-alias.html#FindingYourAWSId) to find account id.
1. (Optional) add tags to resources by specifying them as key-value pairs.
1. Clink launch product.
1. Wait for service catalog to finish deploying the product.  

### Add a subscriber

1. Login into MediaExchange account using the ConsoleUrl to launch ServiceCatalog portfolio manager. This URL is available in the stack outputs section of the MediaExchange CloudFormation stack.
1. The page should list out three products from AWS Solutions Library. Use _subscriber_ to onboard an account that can receive assets through MediaExchange
1. On the product list screen, click on _subscriber_ and then click launch product button.
1. Enter a product name eg. mediaexchange-subscriber-ott.
1. Enter a name for subscriber. This is used for identifying the publisher in the MediaExchange and will be used to link up to a publisher.
1. Enter the AWS Account Id of the subscriber account. See [here](https://docs.aws.amazon.com/IAM/latest/UserGuide/console_account-alias.html#FindingYourAWSId) to find account id.
1. Enter the Canonical User ID of the subscriber. See [here](https://docs.aws.amazon.com/general/latest/gr/acct-identifiers.html#FindingCanonicalId) to find Canonical Id.
1. Enter an email address for subscriber. This email is used to send asset availability notifications.
1. (Optional) add tags to resources by specifying them as key-value pairs.
1. Clink launch product.
1. Wait for service catalog to finish deploying the product.

### Setup transfer agreement

1. Login into MediaExchange account using the ConsoleUrl to launch ServiceCatalog portfolio manager. This URL is available in the stack outputs section of the MediaExchange CloudFormation stack.
1. The page should list out three products from AWS Solutions Library. Use _Transfer agreement_ to link a publisher and subscriber.
1. On the product list screen, click on _transfer agreement_ and then click launch product button.
1. Enter a stack name eg. mediaexchange-studio-ott-agreement.
1. Enter names for publisher and subscriber.
1. (Optional) add tags to resources by specifying them as key-value pairs.
1. Clink launch product.
1. Wait for service catalog to finish deploying the product.
1. The outputs section of the provisioned product has the information needed by the publishers and subscribers to complete a transfer. Please share _ConsoleUrl_ and _PublisherOnboardingSummary_ to the publisher and _ConsoleUrl_ and _SubscriberOnboardingSummary_ to the subscribers over email.

### Share assets from publisher's account

* Login into publisher account using the _ConsoleUrl_ from onboarding information.
* Upload an asset by clicking the "upload" button.
  * Click Add Files, and select an asset from disk.
  * Click Next
  * Click Add Account button next to "Access for other AWS account".
  * In the textbox, enter the value of SUBSCRIBER_CANONICAL_USER_ID from _PublisherOnboardingSummary_
  * Check the "read" box. Click save. This will allow the subscriber account to have read access.
  * Click next
  * Select standard storage class and scroll down to encryption section.
  * Click next and click upload.

### Receive assets in subscriber's account

* Login into subscriber account using the _ConsoleUrl_ from onboarding information.
* You will see a list of assets shared with you.
* Select assets and click the download button to download.

## Notifications  

_TODO_
* The subscriber email should have received and email from AWS SNS requiring them to confirm subscriptions to email messages from MediaExchange.
* Everytime an asset is shared, an email notification is sent out to this address.
* Publishers can send custom event notifications through EventBridge. Please see the tools/push-content.sh for an example.
* Automatic notifications can be disabled by a global configuration parameter in mediaexchange stack if you only want to send custom notifications.


## Developer Guide

1. [quick start](#)
1. [single account deployment](#)
1. [running tests](#)

### Quick start

This method bypasses the service catalog setup to deploy a single publisher, subscriber and mediaexchange. This is primarily intended for developers to test this out from command line.  

* Initialize a shell with the necessary credentials for publisher account. You can do this by adding AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_SESSION_TOKEN as environment variables or by selecting the appropriate profile by adding AWS_PROFILE environment variable.
  1. Navigate to MediaExchnageOnAWS (root) directory.
  1. `make testrole-stack`
  1. Enter the mediaexchange ACCOUNT_ID for parameter TestAccountId.
  1. Do not save arguments to configuration file

* Initialize a shell with the necessary credentials for subscriber account.
  1. Navigate to MediaExchnageOnAWS (root) directory.
  1. `make testrole-stack`
  1. Enter the mediaexchange ACCOUNT_ID for parameter TestAccountId.
  1. Do not save arguments to configuration file

* Initialize a shell with the necessary credentials for MediaExchange account.
  1. Navigate to MediaExchnageOnAWS (root) directory.
  1. `make quickstart`
  1. Follow the instructions to provide publisher and subscriber information. The default values are printed out for the mediaexchange account id.  

### Running tests

The tests are run from the mediaexchange account. The test script assumes a role in the publisher and subscriber accounts to run the tests.

* Initialize a shell with the necessary credentials for MediaExchange account.
  1. Navigate to MediaExchnageOnAWS (root) directory.
  1. `make test`

### Single account deployment

It is possible to simulate a publisher, subscriber and mediaexchange in a single account. This is a simplified setup for test automation and situations where you do not have access to more than one account. Unless you know what you are doing, generally not recommended for production setup.


* Initialize a shell with the necessary credentials for MediaExchange account.
  1. Navigate to MediaExchnageOnAWS (root) directory.
  1. `make localinstall`

It will deploy a publisher, subscriber and mediaexchange in the current account and run the tests.

## License

This project is licensed under the Apache-2.0 License.


## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## Introduction
Traditional file transfer services for Media supply chain are expensive, can add unnecessary hours to a workflow making quick-turn challenging, and not optimized for in-cloud media ecosystems. AWS Customers and ISV Partners can now take advantage of utilizing AWS as a common media storage foundation to create direct hand-offs within the ecosystem eliminating 3rd party delivery mechanisms and the associated time, cost and security concerns. This new Solution, called Media Exchange, AWS Customers and ISV Partners can ensure optimal quality, sustain a consistent understanding of the asset state and confirm asset receipt. The goal of this project is to re-examine media supply-chain with cloud-optimizations in mind, and define a MVP solution that can be deployed with Cloudformation templates. When the solution is deployed in a customer account, a de-facto exchange standard is established with other Media Exchange users.

## Current State  
The traditional file transfer model presents a few key challenges including (a) egress, transfer licensing and transfer costs add up (In case of managed offerings, a per gigabyte transfer cost), (b) content is potentially exposed to a security breach equated to the weakest link in the supply chain, (c) there is often lack of visibility to receipt verification, and (d) file corruption can happen during transfer creating file corruption issues to mitigate. Traditional file transfer services require that you manage a fleet of servers and agents to transfer assets. The sender and receiver must utilize the same software to be able to exchange assets. In a complex distribution model, your network of senders or receivers may use different software protocols requiring an investment on your side in multiple protocols to support multiple partners.  The establishment of a new transfer exchange between Publisher and Subscriber under the existing system can be time consuming and add layers of paperwork and approvals. Moreover, only some of the file transfer service
es offer a cloud-based offering that can deliver assets to object stores in cloud which helps with one-to-many transfers over the on-prem offerings. In today’s complex distribution model, staff must manage content egress, schedule transfers, send or monitor notifications and follow up for verification of receipt across different interfaces. AWS Media Exchange is Solution to address these problems.

## What is Media Exchange
The Media Exchange Solution puts a shared object store (S3 bucket) between publishers and subscribers in a separate, secure AWS account. The sender copies the assets into this shared storage area and creates permissions so that the receivers can pull the content from the S3 bucket. In this Solution, the publishers copy to the S3 bucket and the subscribers pull from there. The assets never leave the S3 data plane in this process, thereby (a) there are no per/GB data egress and transfer costs, (b) this eliminates that egress, schedule and delivery time dependencies, (c) is very fast and (d) there are no servers to manage. The assets are secure by default, encrypted at rest and in transit. Optionally, the assets are encrypted by keys managed by AWS Key Management Service. In the standard deployment model, Media Exchange is deployed in its own account. Assets are stored in this account only for the purposes for transfer and allows a very limited set of permissions to Publishers and Subscribers. Moreover, Media Exchange account works like a temporary custodian but does not have read/write permissions to the assets shared through it. Publishers and Subscribers are on-boarded with Cloudformation templates. Each publisher gets their own S3 bucket to share assets from and each subscriber gets a unique prefix (folder). The publishers share content by copying assets under these named prefixes. A subscriber can only view assets under their assigned prefix and import assets that are shared to them. Publishers and subscribers can only perform these operations from their respective AWS accounts that they have on-boarded with into Media Exchange. A primary benefit of this process is that there are no credentials to share between Publishers and Subscribers. All operations on the assets are tracked via AWS and S3 logs. The assets in the Media Exchange account are lifecycle deleted after a Publisher-defined period.
This is a seamless addition to the current workflow for your customers who use S3 as part of their Media Supply Chain. This Solution is a new offering that is a separate secure AWS account linked to your existing AWS Account. This Solution can also integrate with native AWS file transfer offerings like data sync, snow* devices to help transfer assets between physical locations for customers who do not currently integrate S3 into the media supply chain. You can use native AWS APIs and tools to move content across large geographical distances by leveraging AWS global infrastructure. decoupled transfer process is intrinsically more robust as the assets never leave the S3 data plane The quality risk is much lower in Media Exchange than having to transfer over the internet.

## Architecture

![](images/Architecture.png)


## Workflow(s)

In a typical content owner workflow, the content owner or studio is on-boarded as a publisher, and the MediaExchange is hosted by the supply chain distributor. The Distributor's MAM/DAM/Ingest service is on-boarded as a subscriber to MediaExchange. In a content distributor workflow, the distributor is on-boarded as a publisher to deliver assets to a partner (e.g. OTT service) and the subscriber is the downstream OTT service.

The subscriber pushes the assets and publishers pull the assets from MediaExchange. This push/pull model also enables simple setup and enforcement of both lifecycle policies and alignment with delivery SLAs.

### Preparation
You will need three AWS accounts to test this effectively (a) publisher, (b) subscriber and (c) MediaExchange. The Cloudformation templates are deployed in (c) MediaExchange account.

### Install from AWS Console
(a) deploy MediaExchange Core
1. Login to AWS Console, navigate to services > cloudformation. Note the region on the top right corner.
1. Click on Create Stack.
1. Select "Template is Ready" (default option) in prepare template section and select "Upload a template file" in the specify template section.
1. Click choose file to select core.yaml from media-exchange-base/deployment/ folder.
1. Click next
1. Enter a name of the stack eg. media-exchange-core-oregon.
1. Click next
1. Accept the capabilities and transforms by checking the boxes and click on create stack.
1. Wait for the the status to change to create_complete.

(b) deploy _a_ publisher
1. Click on Create Stack with new resources.
1. Select "Template is Ready" (default option) in prepare template section and select "Upload a template file" in the specify template section.
1. Click choose file to select publisher.yaml from media-exchange-base/deployment/ folder.
1. Click next
1. Enter a name of the stack eg. media-exchange-publisher-studio.
1. Enter a name for publisher. This is used for referring to the publisher in the system.  
1. Enter the AWS Account Id of the publisher account. See [here](https://docs.aws.amazon.com/IAM/latest/UserGuide/console_account-alias.html#FindingYourAWSId) to find account id.
1. Click next
1. Accept the capabilities and transforms by checking the boxes and click on create stack.
1. Wait for the the status to change to create_complete.

(c) deploy _a_ subscriber
1. Click on Create Stack with new resources.
1. Select "Template is Ready" (default option) in prepare template section and select "Upload a template file" in the specify template section.
1. Click choose file to select publisher.yaml from media-exchange-base/deployment/ folder.
1. Click next
1. Enter a name of the stack eg. media-exchange-subscriber-ott.
1. Enter a name for subscriber. This is used for referring to the subscriber in the later steps.  
1. Enter the AWS Account Id of the subscriber account. See [here](https://docs.aws.amazon.com/IAM/latest/UserGuide/console_account-alias.html#FindingYourAWSId) to find account id.
1. Enter the Cannonical Account ID of the subscriber. See [here](https://docs.aws.amazon.com/general/latest/gr/acct-identifiers.html#FindingCanonicalId) to find Cannonical Account Id.
1. Enter an email address for subscriber. This email is used to send notifications.
1. Enter a prefix (a.k.a. folder) for subscriber. All content for the subscriber is shared here.
1. Click next
1. Accept the capabilities and transforms by checking the boxes and click on create stack.
1. Wait for the the status to change to create_complete.

(d) deploy _an_ agreement
1. Click on Create Stack with new resources.
1. Select "Template is Ready" (default option) in prepare template section and select "Upload a template file" in the specify template section.
1. Click choose file to select agreement.yaml from media-exchange-base/deployment/ folder.
1. Click next
1. Enter a name of the stack eg. media-exchange-studio-ott-agreement.
1. Enter the name of the subscriber.
1. Enter the name of the publisher.
1. Click next
1. Accept the capabilities and transforms by checking the boxes and click on create stack.
1. Wait for the the status to change to create_complete.


### Install using Service Catalog

`make install`


### Testing
There are two sample scripts under tools that simulates the workflow supported by Media Exchange. (a) push-content.sh simulates the publisher workflow to share Assets with subscribers and (b) pull-content.sh simulates the subscriber workflow. The agreement stack outputs configuration data to be used in these scripts.

#### Push Content (push-content.sh)
This script is run using publisher account credentials. This shares a dummy file, lists assets in the publisher bucket and sends a notification.

#### Pull Content (pull-content.sh)
This script is run using subscriber account credentials. This downloads the file previously shared and also lists the assets under the prefix.

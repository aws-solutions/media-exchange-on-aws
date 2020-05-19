## Introduction 
Traditional file transfer services for Media supply chain are expensive and not optimized for in-cloud media ecosystems. AWS Customers and ISV Partners wish to take advantage of utilizing AWS as a common technology foundation and their ability to sustain a consistent understanding of the state their content assets are in. The goal of this project is to re-examine media supply-chain with cloud-optimizations in mind, and define an MVP solution that can be deployed with Cloudformation. When the solution is deployed in a customer account, a defacto exchange standard is established with other MediaExchange users.

## Benefits 
Traditional file transfer services require that you manage your feet of servers and agents to transfer assets. The sender and receiver needs to be on the same software ecosystem to be able to exchange assets. Some of the services offer a cloud based offering that can deliver assets to object stores in cloud. This helps with one-to-many transfers over the on-prem offerings. The main challenges with this model is that (a) the cost to transfer includes infrastructure and licenseing cost (In case of managed offerings, a per gigabyte transfer cost). (b) the security of this process is equates to the weekest link in the supply chain and (c) quality risks around file corruption during transfer. 

Media Exchange solution puts a shared object store between publishers and subscribers. The sender copies the assets in this shared area and adjusts permissions so that the receiver(s) can pull the content from this area. If the publishers and subscribers copy from (and to) their s3 buckets, the assets never leave the s3 data plane, thereby (a) there is no per/GB data transfer cost, (b) very fast and (c) there is no servers to manage. The assets are secure by default, encrypted at and transit. And when at rest, they are encrypted by keys managed by AWS Key Management Service. Media Exchange is deployed in it's own account. By default, this account does not have any permissions to read/write the assets shared through it. One of the biggest benefits is that there is no credentials to share between senders and receivers. The respective parties use their own credentials to read/write from the shared area. All operations on the assets are tracked via cloudtrail and s3 logs. The assets are lifecycle deleted after a pre-configured period. 

It works really well if your media supply chain workflows utilizes s3. Even when you are not, this integrates with native AWS file transfer offerings like data sync, snow* devices to help transfer assets between physical locations. You can also use native AWS apis and tools to move content across large geographical distances by levaraging AWS global infrastruture. The decoupled transfer process (push to shared, pull from shared) is intrinsicly more robust and as the assets may never leave the s3 data plane, the quality risk is much lower than having to transfer over the internet. 

## Architechture
Media exchange is designed around native s3 features. The system supports one-to-one and one-to-many transfers. Media Exchange supports an any number of publisher and subscribers, only limited by AWS account level quotas. There is a base system and each of the publishers subscribers are on-boarded on top of that. Each publisher gets their own bucket to share content from and each of the subscribers get their own prefix ( a.k.a folder name). Publishers share assets by coping the assets to subscriber's folder and allocating read permissions to those. Subscribers can read these assets using their own credentials. It also creares roles for publisher and subscribers which can be used to list assets in their bucket (publisher) or under their prefix (acorss all publishers for a subscriber). Once all the assets are copied over, they send a notification via eventbridge. The default implementation sends an email via SNS, but the templates can be easily modified to enable workflow integrarions on the subscriber side. All Assets shared between the publisher and subscriber is encrypted with a KMS key that logically represents their relationship. 

## Workflow(s)
publisher - (push) -> mediaexchange : Content publisher stores content in MediaEchange and shares with subscribers.
publisher - notify via mediaexchange -> subscriber: Content is available. 
subscriber <- (pull) - mediaexchange : Subscriber(s) pull content from media exchnage. 
mediaexchange -> (lifecycle delete) : mediaexchnage purges content from storage. 

## Onboarding
The base system gets their own stack. Each publisher and subscriber is deployed by their own cloudformation stack. Their relationship is deployed by another cloudformation stack. To add a new publisher the following are needed (a) publisher's AWS account Id (b) an email address that is used for additional authentication parameter. See [here](https://docs.aws.amazon.com/IAM/latest/UserGuide/console_account-alias.html#FindingYourAWSId) to find account id. To add a new subscriber, the following are required (a) subscriber's account id, (b) subscriber's cannonical account id, (c) an email address where notifications are sent and (d) an unique prefix. See [here](https://docs.aws.amazon.com/general/latest/gr/acct-identifiers.html#FindingCanonicalId) to find Cannonical Account Id.

Once onboarded in Media Exchange, the publisher and subscribers need to receive a set of identifiers to be used in their workflow. These are available in the respective stack outputs. Please see the testing section for details.  

### Project Structure
The Project is strcutured into a baseline project and a set of additional child projects that is layered over the the core project. The child projects (folders in this repo), address a specific use-case. 

media-exchange-base: is the baseline project. 

### Preparation 
You will need three AWS accounts to test this effectively (a) publisher, (b) subscriber and (c) media exchange. All the cloudformation templates are deployed in (c) media exchange account.  

### Installation
The security posture recommends that the MediaExchange is best deployed in it's own account. There are 4 cloudformation templates in the deployment/ folder. Note: All templates go into same account.  

(a) deploy core
1. Login to AWS Console, navigate to services > cloudformation. Note the region on the top right corner. 
1. Click on Create Stack.
1. Select "Template is Ready" (default option) in prepare template section and select "Upload a template file" in the specify template section. 
1. Click choose file to select core.yaml from media-exchange-base/deployment/ folder.
1. Click next 
1. Enter a name of the stack eg. media-exchange-core-oregon. Leave the parameter values (Environment and Version) at default. 
1. Click next 
1. Accept the capabilities and transforms by checking the boxes and click on create stack.
1. Wait for the the status to change to create_complete. 

(b) deploy _a_ publisher
1. Click on Create Stack with new resources.
1. Select "Template is Ready" (default option) in prepare template section and select "Upload a template file" in the specify template section. 
1. Click choose file to select publisher.yaml from media-exchange-base/deployment/ folder.
1. Click next 
1. Enter a name of the stack eg. media-exchange-publisher-1. Leave the parameter values (Environment and Version) at default. 
1. Enter the AWS Account Id of the publisher account. See [here](https://docs.aws.amazon.com/IAM/latest/UserGuide/console_account-alias.html#FindingYourAWSId) to find account id.
1. Enter an email address for publisher. This email is used for addtional authentication.  
1. Click next 
1. Accept the capabilities and transforms by checking the boxes and click on create stack.
1. Wait for the the status to change to create_complete. 

(c) deploy _a_ subscriber
1. Click on Create Stack with new resources.
1. Select "Template is Ready" (default option) in prepare template section and select "Upload a template file" in the specify template section. 
1. Click choose file to select publisher.yaml from media-exchange-base/deployment/ folder.
1. Click next 
1. Enter a name of the stack eg. media-exchange-subscriber-1. Leave the parameter values (Environment and Version) at default. 
1. Enter the AWS Account Id of the subscriber account. See [here](https://docs.aws.amazon.com/IAM/latest/UserGuide/console_account-alias.html#FindingYourAWSId) to find account id.
1. Enter an email address for subscriber. This email is used to send notifications.
1. Enter a prefix (a.k.a. folder) for subscriber. All content for the subscriber is shared here.
1. Enter the Cannonical Account ID of the subscriber. See [here](https://docs.aws.amazon.com/general/latest/gr/acct-identifiers.html#FindingCanonicalId) to find Cannonical Account Id.
1. Click next 
1. Accept the capabilities and transforms by checking the boxes and click on create stack.
1. Wait for the the status to change to create_complete. 

(d) deploy _an_ agreement
1. Click on Create Stack with new resources.
1. Select "Template is Ready" (default option) in prepare template section and select "Upload a template file" in the specify template section. 
1. Click choose file to select publisher.yaml from media-exchange-base/deployment/ folder.
1. Click next 
1. Enter a name of the stack eg. media-exchange-agreement-1-1. Leave the parameter values (Environment and Version) at default. 
1. Enter the AWS Account Id of the subscriber account. See [here](https://docs.aws.amazon.com/IAM/latest/UserGuide/console_account-alias.html#FindingYourAWSId) to find account id.
1. Enter the AWS Account Id of the publisher account. See [here](https://docs.aws.amazon.com/IAM/latest/UserGuide/console_account-alias.html#FindingYourAWSId) to find account id.
1. Click next 
1. Accept the capabilities and transforms by checking the boxes and click on create stack.
1. Wait for the the status to change to create_complete. 


*Note: the makefile in the project root can be used to install the cloudformation(s) from command line. See usage in the makefile.

### Testing
There are two sample scripts under tools that simulates the workflow supported by Media Exchange. (a) push-content.sh simulates the publisher workflow to share Assets with subscribers and (b) pull-content.sh simulates the subscriber workflow. Each of the scripts need several parameters to be updated inline. They are documented in the script and here for reference. 

#### Push Content (push-content.sh)
This script is run using publisher account credentials. This shares a dummy file, lists assets in the publisher bucket and sends a notification.

```sh
AWS_REGION=" <  eg: us-west-2 > " ## the region where Media Exchange is deployed
PUBLISHER_BUCKET_NAME="< bucket name >" ## bucketname can be found in the stack outputs section of publisher stack. 
KMS_KEY_ID="arn:aws:kms:pppp:xxxxx:key/xxxx" ## keyid can be found in the stack outputs section of agreement stack. 
SUBSCRIBER_CANNONICAL_ID="abcdef..." ## Cannonical Account Id used for subscriber setup
SUBSCRIBER_EXTERNAL_ID="abc@def.com" ## email during in subscriber setup
PUBLISHER_EXTERNAL_ID="abc@def.com" ## email used in pubisher setup
PUBLISHER_ROLE_ARN="arn:aws:iam::xxxxxx:role/xxx" ## role arn can be found in the stack outputs section of publisher stack. 
SESSION_NAME="mxc-read-session" ## any name, only for tracking/collating log data
EVENT_BUS_NAME="< event bus anme >" # can be found in the stack outputs section of core stack. 
```

#### Pull Content (pull-content.sh)
This script is run using subscriber account credentials. This downloads the file previously shared and also lists the assets under the prefix. 

```sh
PUBLISHER_BUCKET_NAME="< bucket name >" ## bucketname can be found in the stack outputs section of publisher stack. 
PREFIX='< folder name > ' ## prefix used in subscriber setup
SUBSCRIBER_EXTERNAL_ID="abc@def.com" ## email during in subscriber setup
SUBSCRIBER_ROLE_ARN="arn:aws:iam::xxxx:role/xxxxx" ## role arn can be found in the stack outputs section of subscriber stack
```
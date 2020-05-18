## Introduction 
Traditional file transfer services for Media supply chain are expensive and not optimized for in-cloud media ecosystems. AWS Customers and ISV Partners wish to take advantage of utilizing AWS as a common technology foundation and their ability to sustain a consistent understanding of the state their content assets are in. The goal of this project is to re-examine media supply-chain with cloud-optimizations in mind, and define an MVP solution that can be deployed with Cloudformation. When the solution is deployed in a customer account, a defacto exchange standard is established with other MediaExchange users.

### Project Structure
The Project is strcutured into a baseline project and a set of additional child projects that is layered over the the core project. The child projects (folders in this repo), address a specific use-case. 

media-exchange-base: is the baseline project. 


### Installation
The security posture recommends that the MediaExchange is best deployed in it's own account. There are 4 cloudformation templates in the deployment/ folder. 

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
1. Enter the Cannonical Account ID of the subscrober. See [here](https://docs.aws.amazon.com/general/latest/gr/acct-identifiers.html#FindingCanonicalId) to find Cannonical Account Id.
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

### Usage

examples: 
    tools/push-content.sh
    tools/pull-content.sh
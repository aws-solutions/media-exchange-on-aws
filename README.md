**[🚀 Solution Landing Page](<https://aws.amazon.com/solutions/implementations/media-exchange-on-aws/>)** | **[🚧 Feature request](https://github.com/aws-solutions/media-exchange-on-aws/issues/new?assignees=&labels=feature-request%2C+enhancement&template=feature_request.md&title=)** | **[🐛 Bug Report](https://github.com/aws-solutions/media-exchange-on-aws/issues/new?assignees=&labels=bug%2C+triage&template=bug_report.md&title=)**

Note: If you want to use the solution without building from source, navigate to Solution Landing Page

## Table of contents

- [Solution Overview](#solution-overview)
- [Architecture Diagram](#architecture-diagram)
- [Solution Components](#solution-components)
  - [Onboarding Tool](#onboarding-tool)
  - [AutoIngest](#autoingest)
  - [MediaSync](#mediasync)
  - [Fixity](#fixity)  
- [Customizing the Solution](#customizing-the-solution)
- [Usage](#usage)
- [Developers](#developers)
- [File Structure](#file-structure)
- [License](#license)

<a name="solution-overview"></a>
# Solution Overview

Traditional file transfer services for Media supply chain are expensive, can add unnecessary hours to a workflow making quick-turn challenging, and not optimized for in-cloud media ecosystems. AWS Customers and ISV Partners can now take advantage of utilizing AWS as a common media storage foundation to create direct hand-offs within the ecosystem. Using this new Solution, called Media Exchange On AWS, AWS Customers and ISV Partners can ensure optimal quality, sustain a consistent understanding of the asset state and confirm asset receipt. The goal of this project is to re-examine media supply-chain with cloud-optimizations in mind, and define an asset transfer solution that can be deployed with CloudFormation templates.

The Media Exchange Solution puts a shared object store (S3 bucket) between publishers and subscribers in a separate, secured AWS account. Publishers copy the assets into this shared storage area so that the subscribers can pull the content from the S3 bucket. The assets do not leave the S3 data plane in this process, thereby (a) there are no per/GB data egress and transfer costs within the same region, (b) eliminates egress, schedule and delivery time dependencies, (c) extremely fast and (d) no servers to manage. The assets are secure by default, encrypted at rest and in transit.
In the standard deployment model, assets are stored in Media Exchange only for the purposes for transfer. Each publisher-subscriber transfer relationship gets its own S3 bucket to share assets. Publishers have write permissions to this bucket, a subscriber can only view assets under their assigned bucket and import assets that are shared to them. Publishers and subscribers perform these operations from their respective AWS accounts that they have on-boarded with into Media Exchange. The primary benefit of this process is that there are no credentials to share between Publishers and Subscribers. All operations on the assets are tracked via AWS CloudTrail and S3 logs. The assets shared in the Media Exchange account are lifecycle deleted after a Publisher-defined period.
This is a seamless addition to the current workflow for your customers who use S3 as part of their Media Supply Chain. It uses standard S3 interface which means most of the tools and services that you are using today, will continue to work. This Solution can also integrate with native AWS file transfer offerings, such as DataSync and Snow* devices to help transfer assets between physical locations for customers who do not currently integrate S3 into the media supply chain. You can also use this to move content across large geographical distances by leveraging AWS global infrastructure.

Please refer to [FAQs](docs/faqs.md) for more details.

<a name="architecture-diagram"></a>
# Architecture Diagram

![Architecture](images/main.png)

The Media Exchange On AWS solution helps build a transfer architecture that puts a shared S3 bucket between publisher and subscribers. In addition, it enables S3 Events from the shared bucket to be routed to the publishers and subscribers over EventBridge and SNS. The shared S3 bucket at the core of the architecture is configured with bucket policy so that the publisher account (or a designated role in publisher account) has read/write permissions and the subscriber account (or a designated role in the subscriber account) has permissions to read from this bucket. This model allows assets to be transferred from publisher to subscriber without having to share credentials. The assets in flight are secured using AWS security best practices. You can read more about security [here](docs/security.md).
The solution is designed to help you build this target transfer architecture. You can manage an arbitrary number of publishers, subscribers and their relationships out of the same deployment. When you deploy the solution, it enables a set of products in AWS Service Catalog so that a Media Exchange administrator can onboard new publishers and subscribers and establish a relationship between them enabling the transfer architecture shown in the diagram. The base system gets deployed in the dedicated account, but other optional components can be deployed in the publisher and subscriber accounts, further simplifying the asset-transfer workflow.

<a name="solution-components"></a>
# Solution Components

<a name="onboarding-tool"></a>
## Onboarding Tool

![Onboarding tool](images/sc.jpeg)

When you deploy the Media Exchange on AWS solution, it adds deployable products on AWS Service Catalog. AWS Service Catalog deploys infrastructure for a number of publisher and subscriber transfers by deploying an unique, isolated set of resources for each of the transfer relationships.

<a name="autoingest"></a>
## AutoIngest

Subscribers to a MediaExchange bucket have the option to automatically ingest assets using this component. It moves assets from Media Exchange into a subscriber-owned S3 bucket. This optional component is deployed in the subscriber’s account. See [here](tools/autoingest)

<a name="mediasync"></a>
## MediaSync

This optional utility moves assets between two Amazon S3 buckets. When you deploy the solution, it enables a new toolset in the AWS Management Console that helps move large (100s of GBs) files or hundreds of thousands of small files. The MediaSync utility scales up by running the copy operation in parallel to thousands of concurrent processes. It can handle file sizes up to 5 TB, is resilient, and cost effective. The utility uses S3 server-side copy to move assets between buckets and AWS Fargate Spot for its compute environment. For details, go [here](tools/mediasync)

<a name="fixity"></a>
## Fixity

This optional utility computes checksums at scale by publishers (at source) or by subscribers (at destination) to ensure file integrity. It uses AWS Batch and Amazon Elastic Compute Cloud (Amazon EC2) Spot Instances to orchestrate the computation infrastructure. It calculates checksums by streaming the objects directly from Amazon S3, so that there is no requirement of local instance storage. For details, go [here](tools/fixity)

<a name="customizing-the-solution"></a>
# Customizing the Solution
Please refer to the developer guide [here](docs/developer.md)

<a name="usage"></a>
# Usage
You will need three AWS accounts to deploy this effectively (a) publisher, (b) subscriber and (c) MediaExchange. The CloudFormation templates are deployed in (c) MediaExchange account. It is also possible to install in a single account for testing. See the implementation guide for instructions.

<a name="developers"></a>
## Developers
Please refer to the developer guide [here](docs/developer.md)

<a name="file-structure"></a>
# File structure

<pre>
├── deployment                          [folder containing build scripts]
├── docs                                [folder containing documentation]
│   ├── developer.md
│   ├── faqs.md
│   └── security.md
├── images                              [folder containing images]
├── tests                               [folder containing integration/system tests]
│   ├── deployment                      [folder containing build scripts for tests]
│   └── python
└── tools                               [Folder containing the optional tools/utilities]
    ├── autoingest                      [ingest media exchange assets into subscriber’s s3 bucket]
    ├── fixity                          [checksums at scale]
    └── mediasync                       [easily move assets between s3 buckets]
</pre>


<a name="license"></a>
# License
See license [here](https://github.com/aws-solutions/media-exchange-on-aws/blob/master/LICENSE.txt)

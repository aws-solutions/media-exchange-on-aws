# Frequently Asked Questions

- [General](#General)
- [Security](#Security)
- [Management](#Management)
- [Pricing](#Pricing)
- [Quality](#Quality)
- [Scalability and Performance](#Scalability-and-Performance)

## General

### What is Media Exchange on AWS?

It is a simple, secure, reliable and scalable way of transferring assets over AWS. It uses Amazon S3 as the underlying transport layer with 11 9's of durability, industry standard security and compliance controls and virtually unlimited bandwidth for individual transfers. Moreover, there are no credentials to share and manage. On top of that, it is significantly cheaper to own and operate.  

### What are the benefits of MediaExchangeOnAWS?

Traditional data transfer services are expensive with licensing and per-gigabyte transfer fees. When compared to traditional file transfer services, MediaExchangeOnAWS is more secure, significantly cheaper to operate with extremely high transfer speeds between sender and recipient. It facilitates direct account-to-account transfers in AWS, thus minimizing egress. There are no licensing fees or servers to manage.

It improves overall security with compliance controls for access and audit, with features like AES256 encryption, AWS managed encryption keys, TLS 1.2 for transport. It integrates with available AWS security related offerings for maximum control. Moreover, with direct account to account transfers there are no credentials to manage.  

It improves quality by minimizing generational loss (lossless transfer) and package/conform risk by shifting ownership of transcode/package to the sender, where package quality/conformance is under the sender's control.

It also enables workflow automation / integration with notifications, access logs and delivery receipts.

### Who are the primary users of MediaExchangeOnAWS?

AWS customers who are using S3 as part of their media processing workflow are the primary users of MediaExchangeOnAWS. In addition, a number of customers are using MediaExchangeOnAWS for supporting their hybrid workflows.

### What type of assets can I transfer with MediaExchangeOnAWS?

MediaExchangeOnAWS is built for file based workflows. Any types of files can be transferred using MediaExchangeOnAWS.

### Do I need to be an Amazon S3 user to take advantage of MediaExchangeOnAWS?

MediaExchangeOnAWS uses Amazon S3 as the underlying storage and transport. You do not need to have your assets in S3 to take advantage of MediaExchangeOnAWS, but you will need to use tools/workflows that can interface with S3.  


## Security

### How does MediaExchangeOnAWS ensure that my assets are secure?

_Encryption_ all the assets are encrypted at rest with AES256 and on transit with TLS.
_Key Management_ all the encryption keys are secured by AWS Key Management Service
_Authentication_ users are authenticated at the account level with AWS Identity and Access Management system. MediaExchangeOnAWS grants access at the account level, so publishers are subscribers use their current authentication mechanism. There is no additional credentials to manage.
_Access Control_ It allocates a bucket per transfer agreement. Publishers have write permissions to the bucket and the subscribers have read permissions. Moreover, all the assets shared with MediaExchangeOnAWS has singular access control that enables read permissions for the subscribers and write permissions for the publishers. On top of that the encryption keys used to protect the assets have similar levels of access control; encrypt permissions for publishers and decrypt for subscribers.
_Audit_ all actions on the assets are tracked in access logs. It is deployed in an AWS account different from publisher and subscriber's account. All of the security & compliance tools/processes that you use today can be applied on this account.


### How do I remain compliant with applicable standards and laws when sharing assets with MediaExchangeOnAWS?

TODO

### How quickly can I remove access and/or cancel transfer?

The assets are owned by the publisher's account. Publishers are in full control at all phases of the transfer. They can remove asset level permissions or even delete the assets at any point in time.  

## Management

### How do I transfer assets with MediaExchangeOnAWS?

Publishers copy the assets over to the exchange bucket corresponding to the subscriber in MediaExchangeOnAWS. The subscribers get a notification about the assets being available and they download them into their account.

### Who is a publisher?

A publisher in MediaExchangeOnAWS is sending assets.

### Who is a subscriber?

A subscriber in MediaExchangeOnAWS is receiving the assets.


### I currently publish assets directly from/to S3 bucket(s). Why should I consider using MediaExchangeOnAWS?

It enables account to account transfers without having to manage shared credentials, having to create a role or bucket policy. As a matter of fact, neither the publishers or subscribers would have to make a change in their security posture to use MediaExchangeOnAWS. The publishers are pushing to a bucket external to their account and the subscribers are pulling from a bucket that is not in their account.

### I am using `xxx` application to move assets to/from Amazon S3. Will it work?

MediaExchangeOnAWS operates with standard s3 interface, so it is highly likely that your current application will continue to operate as is after you point it to the appropriate exchange bucket.

### What type of workflow automation does it support?

It does not come with a workflow orchestrator. Rather it integrates to your workflow automation by standardized event notifications.    

### How do I integrate by workflow(s) to MediaExchangeOnAWS?

It works with standard S3 interface, so, likely any workflow automation that can deliver assets to S3, will work well. In addition, it delivers event notifications of all asset transfers over Amazon Simple Notifications Service and Amazon Eventbridge.

### What type of reporting does it offer?

It creates and saves standard s3 access logs for all activities to a bucket. Publishers can use these to build their own reporting.

### Who owns the assets in transit?

Publishers have full control over the assets in transit.

### Can I customize pricing or terms for select customers?

It is not supported at this time.

### Can I remove an asset that I have shared?

Yes, you can cancel the transfer and remove the assets whenever you want. However, if the recipients have made a copy, MediaExchangeOnAWS can not remove those copies.  

## Pricing

### How much does it cost to transfer assets using Media Exchange On AWS?

There is no additional charge for AWS Batch. You pay for AWS resources (e.g. S3, AWS EC2 etc.) you create to store and move your assets.

### What should I expect in AWS charges for transferring assets?

There is are no data transfer fees if the assets are moving bucket to bucket within the same region. The primary cost of using MediaExchangeOnAWS is the s3 storage fees associated with keeping the assets in the temporary storage area in MediaExchangeOnAWS bucket. In addition there are S3 charges for the GET and PUT API calls and AWS Key Management service costs. In default setting, it is less than `$0.01/GB` in the same region. If you use workflow automation that optimizes the duration in the temporary storage, the costs can be as low as for `$0.001/GB` in the same region.

### What should I expect to pay in data transfer charges?

There are no data transfer charges for moving the assets into MediaExchangeOnAWS bucket. There are no data transfer fees when transferring to other buckets within the same region. If you are delivering to buckets in another region, standard AWS cross region transfer fees apply. Likewise, if you are moving assets to data centers, standard AWS data transfer fees apply based on transport mechanism (direct connect vs internet).

### How does it compare to ``<ABC>`` file transfer service?

In terms of pricing, there are no licensing fees. Moreover, there are no servers to manage. You only pay for the charges incurred for the underlying AWS services, which could net in `1/100th` of the cost in comparable setting.

## Scalability and Performance

### How many transfers can be done in MediaExchangeOnAWS?

MediaExchangeOnAWS can support hundreds of concurrent transfers.  

### I am can transfer `xxx GB` in `yyy hours` with my ``<ABC>`` file transfer service. How does MediaExchangeOnAWS compare?

There is virtually unlimited bandwidth between S3 buckets. You can expect `100GB/s` transfer speed in the same region if you are using the included MediaSync utility. Cross region transfers can go almost as fast. That is moving `1PB` of assets in about `3` hours. This is for a single transfer. You can run many such transfers at the same time.

### Can I track my spending on a specific transfer so that it can be charged back to my customer?

## Quality

### How does MediaExchangeOnAWS ensures that the assets are delivered with source quality and there are no data loss in the process?

The underlying transport, S3, is designed to provide 99.999999999% durability of objects over a given year. This durability level corresponds to an average annual expected loss of 0.000000001% of objects. For example, if you transfer 10,000,000 objects with MediaExchangeOnAWS, you can on average expect to incur a loss of a single object once every 10,000 years.

In addition, it calculates checksums on all network traffic to detect corruption of data packets when storing or retrieving data. This is available and enabled by default on AWS SDK(s) and command line interfaces. Most 3rd party tools, that use AWS SDK, takes advantage of this automatically.

Moreover, if you are looking to compute checksums at the source and destination, there is an included tool `fixity` that can help compute checksums at scale.

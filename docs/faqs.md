# Frequently Asked Questions

- [General](#General)
- [Security](#Security)
- [Management](#Management)
- [Pricing](#Pricing)
- [Quality](#Quality)
- [Scalability and Performance](#Scalability-and-Performance)

## General

### What is Media Exchange on AWS?

It is a simple, secure, reliable and scalable way of transferring files over AWS. It uses Amazon S3 as the underlying transport layer, Amazon S3 offers 11 9's of durability, industry standard security and compliance controls and very high bandwidth for transfers. There are no credentials to share and manage. On top of that, it is more cost effective to own and operate when compared to 3rd party transfer services.

### What are the benefits of Media Exchange on AWS?

Traditional data transfer services are expensive with licensing and per-gigabyte transfer fees. When compared to traditional file transfer services, Media Exchange on AWS is secure and cheaper to operate with extremely high transfer speeds between senders and recipients. It facilitates direct account-to-account transfers in AWS, thus minimizing egress. There are no licensing fees or servers to manage.

It improves overall security with compliance controls for access and audit, with features like AES-256 encryption, AWS managed encryption keys, TLS 1.2 for transport. It integrates with available AWS security related offerings for maximum control. Moreover, with direct account to account transfers there are no credentials to manage.  

It improves quality by minimizing generational loss (lossless transfer) and package/conform risk by shifting ownership of transcode/package to the sender, where package quality/conformance is under the sender's control.

It also enables workflow automation / integration with notifications, access logs and delivery receipts.

### How does Media Exchange on AWS work with other AWS services?

It uses Amazon S3 as the underlying storage and transport for transferring files between two AWS customer accounts. The files are secured with AWS KMS managed encryption keys. It uses AWS IAM for authentication and access control.

### Who are the primary users of Media Exchange on AWS?

AWS customers who are using Amazon S3 as part of their cloud native or hybrid media supply chain workflow are the primary users of Media Exchange on AWS.

### What type of files can I transfer with Media Exchange on AWS?

Media Exchange on AWS is built for file based workflows. Any file type that can be stored in Amazon S3 can also be transferred using Media Exchange on AWS.

### Do I need to be an Amazon S3 user to take advantage of Media Exchange on AWS?

Media Exchange on AWS uses Amazon S3 as the underlying storage and transport. Although, you do not need to have all of your files in S3 to take advantage of Media Exchange on AWS, but you will need to use tools/workflows that can interface with Amazon S3.

## Security

### How does Media Exchange on AWS ensure that my files are secure?

- _Encryption_ the files are encrypted at rest with AES256 and secured in transit with TLS
- _Key Management_ the encryption keys are managed by AWS Key Management Service
- _Authentication_ users are authenticated at the account level with AWS Identity and Access Management. Media Exchange on AWS grants access at the account level, so that there are no additional credentials to manage.
- _Access Control_ It allocates a bucket per transfer agreement. Content publishers have write permissions to the shared bucket and the subscribers have read permissions to the files. Moreover, all the files shared with Media Exchange on AWS has singular access control that enables read permissions for the subscribers and write permissions for the publishers. On top of that the encryption keys used to protect the files have similar levels of access control; encrypt permissions for publishers and decrypt for subscribers.
- _Audit_ all actions on the files are tracked in Amazon S3 access logs. The S3 access logs are made available to the publishers. Media Exchange is deployed in an AWS account different from publisher and subscriber's primary account. All of the security & compliance tools/processes that you use today are applicable and can be used on this account.

### How quickly can I remove access and/or cancel transfer?

The files are owned by the publisher's account. Publishers are in full control at all phases of the transfer. They can remove object level permissions or even delete any of the files at any point in time.  

## Management

### Who is a publisher?

A publisher in Media Exchange on AWS is sending files.

### Who is a subscriber?

A subscriber in Media Exchange on AWS is receiving files.

### How do I transfer files with Media Exchange on AWS?

Publishers copy the files over to the exchange bucket corresponding to the subscriber's transfer agreement in Media Exchange on AWS. The subscribers get a notification about the files being available and they download them into their account.

### I currently publish files directly from/to S3 bucket(s). Why should I consider using Media Exchange on AWS?

It enables account to account transfers without having to manage shared credentials; without having to create a role; or bucket policy. The publishers and subscribers would not have to make a change in their security posture to use Media Exchange on AWS. In this case, publishers are pushing to a shared bucket external to their account and the subscribers are pulling from a bucket that is not in their account.

### I am using my (custom/3rd party) application to move files to/from Amazon S3. Will it work?

Media Exchange on AWS operates with Amazon S3 APIs. It is very likely that your current application will continue to operate without modifications.

### What type of workflow automation does it support?

It does not come with a workflow orchestrator. It integrates to your workflow automation with standardized event notifications.    

### How do I integrate my media processing workflow to Media Exchange on AWS?

It works with Amazon S3 APIs. Event notifications are delivered over Amazon SNS or Eventbridge. You will have to configure your workflow with the respective S3 buckets for sending and receiving files. Similarly, you can trigger your workflow automation steps by configuring it to receive notifications from Amazon SNS or Eventbridge.

### What type of analytics does it offer?

It produces Amazon S3 access logs for all activities to the shared objects. Publishers can use these to build their own reporting.

### Who owns the files in transit?

Publishers have full control over the files in transit.

### Can I customize pricing or terms for select customers?

It is not supported at this time.

### Can I remove an asset that I have shared?

Yes, you can cancel the transfer and remove the files whenever you want. However, if the recipients have made a copy, Media Exchange on AWS does not have control over those.  

## Pricing

### How much does it cost to transfer files using Media Exchange on AWS?

There is no additional charge for using Media Exchange on AWS. You pay for underlying AWS resources (e.g. S3,  EC2 etc.) you create to store and move your files. It is pay-as-you-go and there are no servers to manage.

### What should I expect in AWS charges for transferring files?

There is are no data transfer fees if the files are transferred within the same region. The main operational expense of using Media Exchange on AWS is the s3 storage fees associated with keeping the files in the temporary storage bucket. You can reduce the storage fees by configuring a shorter duration. And also by deleting the files from the temporary storage area after they have been copied over by the subscriber.

In addition to storage, there are S3 charges for the GET and PUT API calls and for key management in AWS KMS.  Standard data transfer charges apply when transferred to another region or over internet.

### What should I expect to pay in data transfer charges?

There are no data transfer charges for moving the files into Media Exchange on AWS bucket. There are no data transfer fees when transferring to other buckets within the same region. If you are delivering to buckets in another region, standard AWS cross region transfer fees apply. Likewise, if you are moving files to your data center, standard AWS data transfer fees apply based on transport mechanism (direct connect vs internet).

### How does Media Exchange on AWS compare to my (custom / 3rd party) file transfer service?

It is a simple, secure and easy to operate. In terms of pricing, there are no licensing fees. There are no servers to manage. You only pay for the charges incurred for the underlying AWS services, which could potentially net in `1/100th` of the cost in comparable setting.

## Scalability and Performance

### How many transfers can be done in Media Exchange on AWS?

Media Exchange on AWS supports hundreds of concurrent transfers.  

### I am transferring hundreds of GBs with my file transfer service. How does Media Exchange on AWS compare?

There is very high bandwidth between S3 buckets. You can expect `100GB/s` transfer speed in the same region if you are using the included MediaSync utility. Cross region transfers take advantage of AWS managed network connectivity.

## Quality

### How does Media Exchange on AWS ensures that the files are delivered with source quality and there are no data loss in the process?

The underlying transport, S3, is designed to provide 99.999999999% durability of objects over a given year. This durability level corresponds to an average annual expected loss of 0.000000001% of objects. For example, if you transfer 10,000,000 objects with Media Exchange on AWS, you can on average expect to incur a loss of a single object once every 10,000 years.

In addition, it calculates checksums on all network traffic to detect corruption of data packets when storing or retrieving data. This is available and enabled by default on AWS SDK(s) and command line interfaces. Most 3rd party tools, that use AWS SDK, takes advantage of this automatically.

Moreover, if you are looking to compute checksums at the source and destination, there is an included tool `fixity` that can help compute checksums at scale.

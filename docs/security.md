## Security

This solution uses AWS best practices for securing the files shared through the object storage area.

* Files are encrypted by default at rest and in transit.
* This solution uses AWS Key Management Service (AWS KMS) to store a customer master key (CMK) that has been established with specific account level permissions. The publisher account can use the CMK to encrypt and the subscriber account can use the CMK to decrypt the Amazon S3 bucket level data keys which are used to decrypt each of the files in the shared MediaExchange Amazon S3 bucket.
* The S3 bucket is configured with specific permissions so that the publisher account can write to it and the subscriber account can read from it.
* The objects in the MediaExchange S3 bucket are owned by the publisher account and the MediaExchange account does not have any (read or write) permissions to the files passing through it.
* The publisher, when sharing through the MediaExchange  S3 bucket, sets read ACLs for subscriber account by specifying the canonical user id of the subscriber.
* The MediaExchange S3 bucket is configured with a lifecycle policy to delete the shared files after a configurable number of days.
* In addition, the actions on files in the MediaExchange S3 bucket are tracked by access logs that are delivered to the Logs S3 bucket, which is made available to the publisher account.

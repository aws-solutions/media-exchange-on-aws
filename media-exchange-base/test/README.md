# Media Exchange Automated Test
There is a set of simple tests that check the core functionality of MediaExchange. These tests are run from the MediaExchange account. The tests assume a limited role in the publisher and subscriber accounts to preform/simulate actions on their behalf to validate the setup.

## Setup

* Setup MediaExchange and onboard a publisher and subscriber
* deploy the test-role by using the included cloudformation template under test/deployment/testrole.yaml.
* configure the test parameters
  * save the publisher on-boarding summary as env.d/publisher.env. This is available as part of the transfer agreement stack output.
  * save the subscriber on-boarding summary as env.d/subscriber.env.This is available as part of the transfer agreement stack output.
  * create a file named common.env under env.d/ with the following content:
    `PUBLISHER_ACCOUNT_ID=<account id of the publisher> SUBSCRIBER_ACCOUNT_ID=<account id of the subscriber>`
* run the tests `make test` using credentials of the MediaExchange account.

## Configuration utility

There is a Configuration utility in the Makefile that automates some if these tasks for a dev (non-service catalog deployment)

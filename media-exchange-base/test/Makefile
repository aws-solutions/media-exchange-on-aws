all: help

help:
	@echo 'runs Media Exchange tests'

DEBUG ?=
STACKPREFIX = mediaexchange
CURRENT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
ENV ?= dev

ndef = $(if $(value $(1)),,$(error $(1) not set))

configure:
	$(call ndef,AWS_REGION)
	$(call ndef,PUBLISHER_NAME)
	$(call ndef,PUBLISHER_ACCOUNT_ID)
	$(call ndef,SUBSCRIBER_NAME)
	$(call ndef,SUBSCRIBER_ACCOUNT_ID)

	@echo saving publihser onboarding info at env.d/publisher.env
	@echo PUBLISHER_ACCOUNT_ID=$(PUBLISHER_ACCOUNT_ID) > env.d/common.env

	@aws --region $(AWS_REGION) cloudformation describe-stacks --stack-name $(STACKPREFIX)-agreement-$(PUBLISHER_NAME)-$(SUBSCRIBER_NAME)-$(ENV)-stack --query "Stacks[0].Outputs[?OutputKey == 'PublisherOnboardingSummary'].OutputValue" --output text > $(CURRENT_DIR)/env.d/publisher.env

	@echo "saving pre-processed cloudformation template to ./template.yaml. Please deploy this in the publihser and subscriber account(s) to create the test-role before running the tests."
	@source env.d/publisher.env && envsubst < deployment/testrole.yaml > template.yaml

	@echo saving subscriber onboarding info at env.d/subscriber.env
	@echo SUBSCRIBER_ACCOUNT_ID=$(SUBSCRIBER_ACCOUNT_ID) >> env.d/common.env

	@aws --region $(AWS_REGION) cloudformation describe-stacks --stack-name $(STACKPREFIX)-agreement-$(PUBLISHER_NAME)-$(SUBSCRIBER_NAME)-$(ENV)-stack --query "Stacks[0].Outputs[?OutputKey == 'SubscriberOnboardingSummary'].OutputValue" --output text > $(CURRENT_DIR)/env.d/subscriber.env

test:
	@ $(CURRENT_DIR)/test_push_pull.sh

clean:
	- @rm -rf env.d/* && rm template.yaml

.PHONY: configure test clean

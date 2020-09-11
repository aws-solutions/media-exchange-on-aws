all: help checkenv

help:
	@echo 'deploys Media Exchange cloudformation templates'

DEBUG ?=
ENV ?= dev
STACKPREFIX = mediaexchange
CURRENT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
RELEASE_VERSION?=v1.0.0

ndef = $(if $(value $(1)),,$(error $(1) not set))

core: ## deploys core
	$(call ndef,AWS_REGION)
	@echo deploying $@ at $(AWS_REGION)
	@aws --region $(AWS_REGION) cloudformation deploy --template-file $(CURRENT_DIR)/deployment/core.yaml --stack-name $(STACKPREFIX)-core-$(ENV)-stack --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides Environment=$(ENV) $(DEBUG) 1>/dev/null

publisher: ## deploys a publisher
	$(call ndef,AWS_REGION)
	$(call ndef,PUBLISHER_NAME)
	$(call ndef,PUBLISHER_ACCOUNT_ID)

	@echo deploying $@ at $(AWS_REGION)
	@aws --region $(AWS_REGION) cloudformation deploy --template-file $(CURRENT_DIR)/deployment/publisher.yaml --stack-name $(STACKPREFIX)-publisher-$(PUBLISHER_NAME)-$(ENV)-stack --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides Environment=$(ENV) PublisherName=$(PUBLISHER_NAME) PublisherAccountId=$(PUBLISHER_ACCOUNT_ID) $(DEBUG) 1>/dev/null


subscriber:  ## deploys a subscriber
	$(call ndef,AWS_REGION)
	$(call ndef,SUBSCRIBER_NAME)
	$(call ndef,SUBSCRIBER_ACCOUNT_ID)
	$(call ndef,SUBSCRIBER_CANONICAL_ACCOUNT_ID)
	$(call ndef,SUBSCRIBER_EMAIL)

	@echo deploying $@ at $(AWS_REGION)
	@aws --region $(AWS_REGION) cloudformation deploy --template-file $(CURRENT_DIR)/deployment/subscriber.yaml --stack-name $(STACKPREFIX)-subscriber-$(SUBSCRIBER_NAME)-$(ENV)-stack --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides Environment=$(ENV) SubscriberAccountId=$(SUBSCRIBER_ACCOUNT_ID) CanonicalAccountID=$(SUBSCRIBER_CANONICAL_ACCOUNT_ID) Email=$(SUBSCRIBER_EMAIL) Prefix=$(SUBSCRIBER_NAME) SubscriberName=$(SUBSCRIBER_NAME) $(DEBUG) 1>/dev/null

agreement: ## deploys an agreement
	$(call ndef,AWS_REGION)
	$(call ndef,SUBSCRIBER_NAME)
	$(call ndef,PUBLISHER_NAME)

	@echo deploying $@ at $(AWS_REGION)
	@aws --region $(AWS_REGION) cloudformation deploy --template-file $(CURRENT_DIR)/deployment/agreement.yaml --stack-name $(STACKPREFIX)-agreement-$(PUBLISHER_NAME)-$(SUBSCRIBER_NAME)-$(ENV)-stack --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides Environment=$(ENV) SubscriberName=$(SUBSCRIBER_NAME) PublisherName=$(PUBLISHER_NAME) $(DEBUG)  1>/dev/null

	@echo saving publihser onboarding info at tools/publisher.env
	@aws --region $(AWS_REGION) cloudformation describe-stacks --stack-name $(STACKPREFIX)-agreement-$(PUBLISHER_NAME)-$(SUBSCRIBER_NAME)-$(ENV)-stack --query "Stacks[0].Outputs[?OutputKey == 'PublisherOnboardingSummary'].OutputValue" --output text > $(CURRENT_DIR)/tools/publisher.env

	@echo saving subscriber onboarding info at tools/subscriber.env
	@aws --region $(AWS_REGION) cloudformation describe-stacks --stack-name $(STACKPREFIX)-agreement-$(PUBLISHER_NAME)-$(SUBSCRIBER_NAME)-$(ENV)-stack --query "Stacks[0].Outputs[?OutputKey == 'SubscriberOnboardingSummary'].OutputValue" --output text > $(CURRENT_DIR)/tools/subscriber.env


# templates := $(patsubst deployment/%.yaml,%.yaml.template,$(wildcard deployment/*.yaml))
install:
	$(call ndef,AWS_REGION)
	$(call ndef,CFN_BUCKET)
	$(call ndef,RELEASE_VERSION)
	@aws --region $(AWS_REGION) s3 sync $(CURRENT_DIR)/deployment s3://$(CFN_BUCKET)/media-exchange-on-aws/$(RELEASE_VERSION) --delete --exact-timestamps --exclude "*" --include "*.yaml"

	@echo deploying to service catalog at $(AWS_REGION)

	@aws --region $(AWS_REGION) cloudformation deploy --template-file $(CURRENT_DIR)/deployment/servicecatalog.yaml --stack-name $(STACKPREFIX)-$(ENV)-stack --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides Environment=$(ENV) CfnBucket=$(CFN_BUCKET) $(DEBUG) 1>/dev/null

	@echo login to service catalog in mediaexchange account with the following url to onboard publishers and subscribers

	@aws --region $(AWS_REGION) cloudformation describe-stacks --stack-name $(STACKPREFIX)-$(ENV)-stack --query "Stacks[0].Outputs[?OutputKey == 'ConsoleUrl'].OutputValue" --output text


.PHONY: install core publisher subscriber agreement

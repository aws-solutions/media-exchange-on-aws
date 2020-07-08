all: help checkenv

help:
	@echo 'deploys Media Exchange managed transfer s3 batch job integration'

DEBUG ?=

ENV ?= dev
STACKPREFIX = mediaexchange-managedtransfer
CURRENT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
CHECKSUM=true

ndef = $(if $(value $(1)),,$(error $(1) not set))
$(call ndef,CFN_BUCKET)
$(call ndef,ONBOARD_ENV_PATH)

include $(ONBOARD_ENV_PATH)

configure:
	@mkdir -p build

push: deployment/push.yaml

	@echo packaging $@
	@sam build -s $(CURRENT_DIR) -b $(CURRENT_DIR)/build --template $(CURRENT_DIR)/$< --use-container  $(DEBUG)

	@echo deploying $@ at $(AWS_REGION)
	@sam deploy --region $(AWS_REGION) --template-file $(CURRENT_DIR)/build/template.yaml --stack-name $(STACKPREFIX)-s3job-$@-$(ENV)-stack --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM  --s3-bucket $(CFN_BUCKET) --s3-prefix scratch --force-upload --parameter-overrides Environment=$(ENV) PublisherName=$(PUBLISHER_NAME) SubscriberName=$(SUBSCRIBER_NAME) BucketName=$(BUCKET_NAME) KMSKeyArn=$(KMS_KEY_ID) SubscriberCannoicalAccountID=$(SUBSCRIBER_CANNONICAL_ACCOUNT_ID) Checksum=$(CHECKSUM) ImageName=$(STACKPREFIX)/aws-cli $(DEBUG)

pull: deployment/pull.yaml
	$(call ndef,DESTINATION_BUCKET_NAME)


	@echo packaging $@
	@sam build -s $(CURRENT_DIR) -b $(CURRENT_DIR)/build --template $(CURRENT_DIR)/$< --use-container  $(DEBUG)

	@echo deploying $@ at $(AWS_REGION)
	@sam deploy --region $(AWS_REGION) --template-file $(CURRENT_DIR)/build/template.yaml --stack-name $(STACKPREFIX)-s3job-$@-$(ENV)-stack --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM  --s3-bucket $(CFN_BUCKET) --s3-prefix scratch --force-upload --parameter-overrides Environment=$(ENV) PublisherName=$(PUBLISHER_NAME) SubscriberName=$(SUBSCRIBER_NAME) DestinationBucketName=$(DESTINATION_BUCKET_NAME) ImageName=$(STACKPREFIX)/aws-cli $(DEBUG)

clean: ## clears the build directory
	@rm -rf build/*

.PHONY: checkenv configure install clean package

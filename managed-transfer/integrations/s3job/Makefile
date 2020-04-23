all: help checkenv

help:
	@echo 'deploys Media Exchange managed transfer s3 batch job integration'

DEBUG ?=

ENV ?= dev
STACKPREFIX = mediaexchange-managedtransfer
CURRENT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
CHECKSUM ?= false
ndef = $(if $(value $(1)),,$(error $(1) not set))

configure:
	@mkdir -p build

push: deployment/push.yaml configure
	$(call ndef,AWS_REGION)
	$(call ndef,CFN_BUCKET)
	$(call ndef,MEDIAEXCHANGE_BUCKET_NAME)
	$(call ndef,KMS_KEY_ID)
	$(call ndef,SUBSCRIBER_CANONICAL_ACCOUNT_ID)

	@echo packaging $@
	@sam build -s $(CURRENT_DIR) -b $(CURRENT_DIR)/build --template $(CURRENT_DIR)/$< --use-container  $(DEBUG)

	@echo deploying $@ at $(AWS_REGION)
	@sam deploy --region $(AWS_REGION) --template-file $(CURRENT_DIR)/build/template.yaml --stack-name $(STACKPREFIX)-s3job-$@-$(ENV)-stack --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM  --s3-bucket $(CFN_BUCKET) --s3-prefix scratch --force-upload --parameter-overrides Environment=$(ENV) MediaExchangeBucketName=$(MEDIAEXCHANGE_BUCKET_NAME) KMSKeyArn=$(KMS_KEY_ID) SubscriberCannoicalAccountID=$(SUBSCRIBER_CANONICAL_ACCOUNT_ID) Checksum=$(CHECKSUM) ImageName=$(STACKPREFIX)/aws-cli $(DEBUG)

pull: deployment/pull.yaml configure
	$(call ndef,AWS_REGION)
	$(call ndef,CFN_BUCKET)
	$(call ndef,DESTINATION_BUCKET_NAME)

	@echo packaging $@
	@sam build -s $(CURRENT_DIR) -b $(CURRENT_DIR)/build --template $(CURRENT_DIR)/$< --use-container  $(DEBUG)

	@echo deploying $@ at $(AWS_REGION)
	@sam deploy --region $(AWS_REGION) --template-file $(CURRENT_DIR)/build/template.yaml --stack-name $(STACKPREFIX)-s3job-$@-$(ENV)-stack --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM  --s3-bucket $(CFN_BUCKET) --s3-prefix scratch --force-upload --parameter-overrides Environment=$(ENV) DestinationBucketName=$(DESTINATION_BUCKET_NAME) Checksum=$(CHECKSUM) ImageName=$(STACKPREFIX)/aws-cli $(DEBUG)

clean: ## clears the build directory
	@rm -rf build/*

.PHONY: checkenv configure install clean package

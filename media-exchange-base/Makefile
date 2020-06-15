all: help checkenv

help:
	@echo 'deploys Media Exchange cloudformation templates'

DEBUG ?=

VERSION ?= latest
ENV ?= dev
STACKPREFIX = mediaexchange
CFNBUCKET ?= change_me

RELEASE_VERSION?=v1.0.0

ndef = $(if $(value $(1)),,$(error $(1) not set))
checkenv: ## checks environment
	$(call ndef,AWS_REGION)
	$(call ndef,AWS_REGION)
	$(call ndef,CFNBUCKET)
	@command -v aws >/dev/null 2>&1 || ( echo >&2 "awscli is not installed. Please see install guide here: https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html"; exit 1; )

configure: checkenv
	@mkdir -p build

%.template: deployment/% ## packages cloudformation
	@echo packaging $@
	@aws --region $(AWS_REGION) cloudformation package --template-file $< --output-template-file build/$@  --s3-bucket $(CFNBUCKET) --s3-prefix scratch --force-upload $(DEBUG) 1>/dev/null

core: core.yaml.template ## deploys core
	@echo deploying $@ at $(AWS_REGION)
	@aws --region $(AWS_REGION) cloudformation deploy --template-file build/$< --stack-name $(STACKPREFIX)-core-$(ENV)-stack --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM $(DEBUG) 1>/dev/null

publisher: publisher.yaml.template ## deploys a publisher
	$(call ndef,PUBLISHER_NAME)
	$(call ndef,PUBLISHER_ACCOUNT_ID)

	@echo deploying $@ at $(AWS_REGION)
	@aws --region $(AWS_REGION) cloudformation deploy --template-file build/$< --stack-name $(STACKPREFIX)-publisher-$(PUBLISHER_NAME)-$(ENV)-stack --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides PublisherName=$(PUBLISHER_NAME) PublisherAccountId=$(PUBLISHER_ACCOUNT_ID) $(DEBUG) 1>/dev/null


subscriber: subscriber.yaml.template ## deploys a subscriber
	$(call ndef,SUBSCRIBER_NAME)
	$(call ndef,SUBSCRIBER_ACCOUNT_ID)
	$(call ndef,SUBSCRIBER_CANNONICAL_ACCOUNT_ID)
	$(call ndef,SUBSCRIBER_EMAIL)

	@echo deploying $@ at $(AWS_REGION)
	@aws --region $(AWS_REGION) cloudformation deploy --template-file build/$< --stack-name $(STACKPREFIX)-subscriber-$(SUBSCRIBER_NAME)-$(ENV)-stack --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides SubscriberAccountId=$(SUBSCRIBER_ACCOUNT_ID) CannonicalAccountID=$(SUBSCRIBER_CANNONICAL_ACCOUNT_ID) Email=$(SUBSCRIBER_EMAIL) Prefix=$(SUBSCRIBER_NAME) SubscriberName=$(SUBSCRIBER_NAME) $(DEBUG) 1>/dev/null

agreement: agreement.yaml.template ## deploys an agreement
	$(call ndef,SUBSCRIBER_NAME)
	$(call ndef,PUBLISHER_NAME)

	@echo deploying $@ at $(AWS_REGION)
	@aws --region $(AWS_REGION) cloudformation deploy --template-file build/$< --stack-name $(STACKPREFIX)-agreement-$(PUBLISHER_NAME)-$(SUBSCRIBER_NAME)-$(ENV)-stack --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides SubscriberName=$(SUBSCRIBER_NAME) PublisherName=$(PUBLISHER_NAME) $(DEBUG)  1>/dev/null

# # templates := $(patsubst deployment/%.yaml,%.yaml.template,$(wildcard deployment/*.yaml))
# install: agreement.yaml.template publisher.yaml.template subscriber.yaml.template
# 	$(call ndef,CFNBUCKET)
# 	$(call ndef,RELEASE_VERSION)
# 	@aws --region $(AWS_REGION) s3 sync build s3://$(CFNBUCKET)/media-exchange-on-aws/$(RELEASE_VERSION)
#
# 	@echo deploying $@ at $(AWS_REGION)
# 	@aws --region $(AWS_REGION) cloudformation deploy --template-file build/$@.yaml.template --stack-name $(STACKPREFIX)-servicecatalog-$(ENV)-stack --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM $(DEBUG) 1>/dev/null

clean: ## clears the build directory
	@rm -rf build/*

.PHONY: checkenv configure release clean

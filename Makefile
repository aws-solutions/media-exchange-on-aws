all: help
help:
	@echo 'deploys Media Exchange cloudformation templates'

GUIDED ?= --guided
ENV ?= dev
CURRENT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
RELEASE_VERSION?=v1.0.0
SOLUTIONS_BUCKET_NAME?=media-solutions-bucket

ACCOUNT_ID = $(shell aws sts get-caller-identity --query Account --output text)
TEST_ACCOUNT_ID ?= $(ACCOUNT_ID)
PUBLISHER_ACCOUNT_ID ?= $(ACCOUNT_ID)
SUBSCRIBER_ACCOUNT_ID ?= $(ACCOUNT_ID)
SUBSCRIBER_CANONICAL_ID ?= $(shell aws s3api list-buckets --query "Owner.ID" --output text)
SUBSCRIBER_EMAIL ?= nomail@email.com
PARAMETER_OVERRIDES := Environment=$(ENV)

ifeq ($(PUBLISHER_ACCOUNT_ID), $(ACCOUNT_ID))
	PUBLISHER_ROLE ?= arn:aws:iam::$(ACCOUNT_ID):role/publisher-role
endif

ifeq ($(SUBSCRIBER_ACCOUNT_ID), $(ACCOUNT_ID))
	SUBSCRIBER_ROLE ?= arn:aws:iam::$(ACCOUNT_ID):role/subscriber-role
endif

%-stack: deployment/%.yaml
	sam deploy -t $(CURRENT_DIR)/$< --stack-name mediaexchange-$@-$(ENV) --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides $(PARAMETER_OVERRIDES) --config-env $@ $(GUIDED) --region $(AWS_REGION)

testrole-stack:  GUIDED="--guided"
publisher-stack: PARAMETER_OVERRIDES += 'PublisherRole=$(PUBLISHER_ROLE) PublisherAccountId=$(PUBLISHER_ACCOUNT_ID) PublisherName=studio'
subscriber-stack: PARAMETER_OVERRIDES += 'SubscriberRole=$(SUBSCRIBER_ROLE) SubscriberAccountId=$(SUBSCRIBER_ACCOUNT_ID) SubscriberName=network CanonicalID=$(SUBSCRIBER_CANONICAL_ID) Email=$(SUBSCRIBER_EMAIL)'
agreement-stack: PARAMETER_OVERRIDES += 'PublisherName=studio SubscriberName=network Notifications=yes'

quickstart: core-stack publisher-stack subscriber-stack agreement-stack

test:
ifneq ($(PUBLISHER_ACCOUNT_ID), $(ACCOUNT_ID))
	$(info ****ACTION**** please deploy cloudformation template :testrole.yaml: to create the test role in $(PUBLISHER_ACCOUNT_ID))
endif
ifneq ($(SUBSCRIBER_ACCOUNT_ID), $(ACCOUNT_ID))
	$(info ****ACTION**** please deploy cloudformation template :testrole.yaml: to create the test role in $(SUBSCRIBER_ACCOUNT_ID))
endif

	@echo saving publihser onboarding info at tests/publisher.env
	@aws cloudformation describe-stacks --stack-name mediaexchange-agreement-stack-$(ENV) --query "Stacks[0].Outputs[?OutputKey == 'PublisherOnboardingSummary'].OutputValue" --output text > $(CURRENT_DIR)/tests/publisher.env

	@echo saving subscriber onboarding info at tests/subscriber.env
	@aws cloudformation describe-stacks --stack-name mediaexchange-agreement-stack-$(ENV) --query "Stacks[0].Outputs[?OutputKey == 'SubscriberOnboardingSummary'].OutputValue" --output text > $(CURRENT_DIR)/tests/subscriber.env

	#TODO: containers?
	@cd $(CURRENT_DIR)/tests; python -m pytest -s python/

localinstall: GUIDED=''
localinstall: testrole-stack quickstart test

################

AWS_REGION ?= $(shell aws configure get region )
TEMPLATE_REPO_BUCKET ?=mxc-$(AWS_REGION)-$(ENV)-$(ACCOUNT_ID)-templaterepo

configure: templaterepo-stack

install: configure

	@for product in core publisher subscriber agreement; do \
	aws s3 cp $(CURRENT_DIR)/deployment/$$product.yaml s3://$(TEMPLATE_REPO_BUCKET)/media-exchange-on-aws/$(RELEASE_VERSION)/$$product.yaml --no-progress --only-show-errors; \
	done; \
	sed "s/$(SOLUTIONS_BUCKET_NAME)/$(TEMPLATE_REPO_BUCKET)/g" < $(CURRENT_DIR)/deployment/servicecatalog.yaml > /tmp/servicecatalog.yaml.template

	@sam deploy -t /tmp/servicecatalog.yaml.template $(GUIDED) --stack-name mediaexchange-servicecatalog-stack-$(ENV) --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides Environment=$(ENV) --config-env servicecatalog-stack

	- @rm /tmp/servicecatalog.yaml.template

.PHONY: install quickstart test localinstall configure

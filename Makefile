all: help
help:
	@echo 'deploys Media Exchange cloudformation templates'

SOLUTION_NAME = "media-exchange-on-aws"
VERSION ?= 1.1.0

GUIDED ?= --guided
ENV ?= dev
CURRENT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
STACKPREFIX=mediaexchange


ACCOUNT_ID := $(shell aws sts get-caller-identity --query Account --output text)
PARAMETER_OVERRIDES := Environment=$(ENV)
AWS_REGION ?= $(shell aws configure get region --output text)


%-stack-build: deployment/%.yaml configure
	@echo "Building template..."
	@sam build -s $(CURRENT_DIR) -b $(CURRENT_DIR)/build/$*/ --template $(CURRENT_DIR)/$< --use-container

%-stack-deploy: %-stack-build
	@echo "deploying cloudformation template"
	sam deploy -t $(CURRENT_DIR)/build/$*/template.yaml --stack-name $(STACKPREFIX)-$*-$(ENV) --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --resolve-s3 --parameter-overrides  $(PARAMETER_OVERRIDES) --config-env $* $(GUIDED) --region $(AWS_REGION)

%-stack-delete:
	@echo "deleting cloudformation stack"
	aws cloudformation delete-stack --stack-name $(STACKPREFIX)-$*-$(ENV)
	aws cloudformation wait stack-delete-complete --stack-name $(STACKPREFIX)-$*-$(ENV)

quickstart: publisher-stack-deploy subscriber-stack-deploy agreement-stack-deploy
quickclean: agreement-stack-delete publisher-stack-delete subscriber-stack-delete

##Testing
TEST_ACCOUNT_ID ?= $(ACCOUNT_ID)

ifeq ($(PUBLISHER_ACCOUNT_ID), $(ACCOUNT_ID))
	PUBLISHER_ROLE ?= arn:aws:iam::$(ACCOUNT_ID):role/publisher-role
endif

ifeq ($(SUBSCRIBER_ACCOUNT_ID), $(ACCOUNT_ID))
	SUBSCRIBER_ROLE ?= arn:aws:iam::$(ACCOUNT_ID):role/subscriber-role
endif

testrole-stack-deploy:
	sam deploy -t $(CURRENT_DIR)/tests/deployment/testrole.yaml --stack-name $(STACKPREFIX)-testrole-$(ENV) --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --resolve-s3 --parameter-overrides  $(PARAMETER_OVERRIDES) --config-env $* $(GUIDED) --region $(AWS_REGION)

testrole-stack-deploy:  PARAMETER_OVERRIDES += TestAccountId=$(TEST_ACCOUNT_ID)


################
TEMPLATE_OUTPUT_BUCKET ?= $(STACKPREFIX)-cftemplates-$(AWS_REGION)-$(ACCOUNT_ID)

EXT_VERSION := $(VERSION)-$(shell date +"%s")

configure:
	@aws s3api head-bucket --bucket $(TEMPLATE_OUTPUT_BUCKET) || aws s3 mb s3://$(TEMPLATE_OUTPUT_BUCKET)
	@cd $(CURRENT_DIR)/deployment/ && ./build-s3-dist.sh $(TEMPLATE_OUTPUT_BUCKET) $(SOLUTION_NAME) $(EXT_VERSION)

	@for product in publisher subscriber agreement; do \
		aws s3 cp $(CURRENT_DIR)/deployment/global-s3-assets/$$product.template s3://$(TEMPLATE_OUTPUT_BUCKET)/$(SOLUTION_NAME)/$(EXT_VERSION)/$$product.template --no-progress --only-show-errors; \
	done

install: configure

	@sam deploy -t $(CURRENT_DIR)/deployment/global-s3-assets/media-exchange-on-aws.template $(GUIDED) --stack-name $(STACKPREFIX)-servicecatalog-stack-$(ENV) --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides Environment=$(ENV) --config-env servicecatalog-stack --region $(AWS_REGION)

	@sam deploy -t $(CURRENT_DIR)/deployment/global-s3-assets/provision.template --stack-name $(STACKPREFIX)-selfprovision-$(ENV) --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides Environment=$(ENV) PublisherAccountId=$(ACCOUNT_ID) PublisherName=self SubscriberAccountId=$(ACCOUNT_ID) SubscriberName=self --config-env selfprovision-stack --role-arn   arn:aws:iam::$(ACCOUNT_ID):role/mediaexchange-$(AWS_REGION)-$(ENV)-cfn-deploy --region $(AWS_REGION)

provision:

	@sam deploy -t $(CURRENT_DIR)/deployment/global-s3-assets/provision.template $(GUIDED) --stack-name $(STACKPREFIX)-provision-$(ENV) --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides Environment=$(ENV) --config-env provision-stack --role-arn  arn:aws:iam::$(ACCOUNT_ID):role/mediaexchange-$(AWS_REGION)-$(ENV)-cfn-deploy --region $(AWS_REGION)

summarize:

	@echo AWS S3 Console URL
	@aws cloudformation describe-stacks --stack-name $(shell aws cloudformation describe-stacks --stack-name $(STACKPREFIX)-provision-$(ENV) --query "Stacks[0].Outputs[?OutputKey == 'AgreementStackArn'].OutputValue" --output text) --query "Stacks[0].Outputs[?OutputKey == 'ConsoleUrl'].OutputValue" --output text

	@echo Publisher onboarding summary
	@aws cloudformation describe-stacks --stack-name $(shell aws cloudformation describe-stacks --stack-name $(STACKPREFIX)-provision-$(ENV) --query "Stacks[0].Outputs[?OutputKey == 'AgreementStackArn'].OutputValue" --output text) --query "Stacks[0].Outputs[?OutputKey == 'PublisherOnboardingSummary'].OutputValue" --output text | sed 's/ /\n/g'

	@echo Subscriber onboarding summary
	@aws cloudformation describe-stacks --stack-name $(shell aws cloudformation describe-stacks --stack-name $(STACKPREFIX)-provision-$(ENV) --query "Stacks[0].Outputs[?OutputKey == 'AgreementStackArn'].OutputValue" --output text) --query "Stacks[0].Outputs[?OutputKey == 'SubscriberOnboardingSummary'].OutputValue" --output text | sed 's/ /\n/g'


test:
ifneq ($(PUBLISHER_ACCOUNT_ID), $(ACCOUNT_ID))
	$(info ****ACTION**** please deploy cloudformation template :testrole.yaml: to create the test role in $(PUBLISHER_ACCOUNT_ID))
endif
ifneq ($(SUBSCRIBER_ACCOUNT_ID), $(ACCOUNT_ID))
	$(info ****ACTION**** please deploy cloudformation template :testrole.yaml: to create the test role in $(SUBSCRIBER_ACCOUNT_ID))
endif

	@echo saving subscriber onboarding info at tests/subscriber.env
	@aws cloudformation describe-stacks --stack-name $(shell aws cloudformation describe-stacks --stack-name $(STACKPREFIX)-provision-$(ENV) --query "Stacks[0].Outputs[?OutputKey == 'AgreementStackArn'].OutputValue" --output text) --query "Stacks[0].Outputs[?OutputKey == 'SubscriberOnboardingSummary'].OutputValue" --output text > $(CURRENT_DIR)/tests/subscriber.env

	@echo saving publihser onboarding info at tests/publisher.env
	@aws cloudformation describe-stacks --stack-name $(shell aws cloudformation describe-stacks --stack-name $(STACKPREFIX)-provision-$(ENV) --query "Stacks[0].Outputs[?OutputKey == 'AgreementStackArn'].OutputValue" --output text) --query "Stacks[0].Outputs[?OutputKey == 'PublisherOnboardingSummary'].OutputValue" --output text > $(CURRENT_DIR)/tests/publisher.env

	#TODO: containers?
	@cd $(CURRENT_DIR)/tests; VAR=value python3 -m pytest -s python/


testclean:
	- aws cloudformation delete-stack --stack-name $(STACKPREFIX)-provision-$(ENV) --region $(AWS_REGION)
	- aws cloudformation wait stack-delete-complete --stack-name $(STACKPREFIX)-provision-$(ENV) --region $(AWS_REGION)

clean: testclean
	aws cloudformation delete-stack --stack-name $(STACKPREFIX)-selfprovision-$(ENV) --region $(AWS_REGION)
	aws cloudformation wait stack-delete-complete --stack-name $(STACKPREFIX)-selfprovision-$(ENV) --region $(AWS_REGION)

	aws cloudformation delete-stack --stack-name $(STACKPREFIX)-servicecatalog-stack-$(ENV) --region $(AWS_REGION)
	aws cloudformation wait stack-delete-complete --stack-name $(STACKPREFIX)-servicecatalog-stack-$(ENV) --region $(AWS_REGION)


.PHONY: install provision test clean testclean quickstart quickclean

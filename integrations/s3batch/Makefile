all: help checkenv

help:
	@echo 'deploys MediaExchange transfer utility cloudformation templates'

GUIDED ?= --guided
VERSION ?= latest
ENV ?= dev

STACKPREFIX = mediaexchange-integrations-s3batch
CURRENT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
IMAGENAME = ${STACKPREFIX}/aws-cli

ACCOUNT_ID = $(shell aws sts get-caller-identity --query Account --output text)
TEST_ACCOUNT_ID ?= $(ACCOUNT_ID)
PUBLISHER_ACCOUNT_ID ?= $(ACCOUNT_ID)
SUBSCRIBER_ACCOUNT_ID ?= $(ACCOUNT_ID)
SUBSCRIBER_CANONICAL_ID ?= $(shell aws s3api list-buckets --query "Owner.ID" --output text)
PARAMETER_OVERRIDES := Environment=$(ENV)
AWS_REGION ?= $(shell aws configure get region --output text)


ifeq ($(PUBLISHER_ACCOUNT_ID), $(ACCOUNT_ID))
	PUBLISHER_ROLE ?= arn:aws:iam::$(ACCOUNT_ID):role/publisher-role
endif
ifeq ($(SUBSCRIBER_ACCOUNT_ID), $(ACCOUNT_ID))
	SUBSCRIBER_ROLE ?= arn:aws:iam::$(ACCOUNT_ID):role/subscriber-role
endif


%-stack: deployment/%.yaml
	sam deploy -t $(CURRENT_DIR)/$< --stack-name $(STACKPREFIX)-$@-$(ENV) --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides $(PARAMETER_OVERRIDES) --config-env $@ $(GUIDED)

configure:
	@mkdir -p build

publish: configure build

	@echo "Publishing Docker image to registry..."
	@aws ecr get-login-password | docker login --username AWS --password-stdin $(ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com

	docker tag ${IMAGENAME}:latest $(ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com/${IMAGENAME}:${VERSION}
	docker push $(ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com/${IMAGENAME}:${VERSION}

build:
	@echo "Building docker image..."
	docker build -t $(IMAGENAME):$(VERSION) copier/

package: repository-stack publish

repository-stack:	PARAMETER_OVERRIDES += 'RepositoryName=${IMAGENAME}'
batch-stack:	PARAMETER_OVERRIDES += 'ImageName=${IMAGENAME}'
# batch-stack: package
install: network-stack batch-stack

	#
	# push: deployment/push.yaml configure
	# 	$(call ndef,AWS_REGION)
	# 	$(call ndef,CFN_BUCKET)
	# 	$(call ndef,MEDIAEXCHANGE_BUCKET_NAME)
	# 	$(call ndef,KMS_KEY_ID)
	# 	$(call ndef,SUBSCRIBER_CANONICAL_USER_ID)
	#
	# 	@echo packaging $@
	# 	@sam build -s $(CURRENT_DIR) -b $(CURRENT_DIR)/build --template $(CURRENT_DIR)/$< --use-container  $(DEBUG)
	#
	# 	@echo deploying $@ at $(AWS_REGION)
	# 	@sam deploy --region $(AWS_REGION) --template-file $(CURRENT_DIR)/build/template.yaml --stack-name $(STACKPREFIX)-s3job-$@-$(ENV)-stack --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM  --s3-bucket $(CFN_BUCKET) --s3-prefix scratch --force-upload --parameter-overrides Environment=$(ENV) MediaExchangeBucketName=$(MEDIAEXCHANGE_BUCKET_NAME) KMSKeyArn=$(KMS_KEY_ID) SubscriberCannoicalUserID=$(SUBSCRIBER_CANONICAL_USER_ID) Checksum=$(CHECKSUM) ImageName=$(STACKPREFIX)/aws-cli $(DEBUG)

%-build: deployment/%.yaml configure
	@echo "Building lambda..."
	@sam build -s $(CURRENT_DIR) -b $(CURRENT_DIR)/build --template $(CURRENT_DIR)/$< --use-container  $(DEBUG)

subscriberhelper-stack: PARAMETER_OVERRIDES += 'ImageName=${IMAGENAME}'
subscriberhelper-stack: pull-build
	sam deploy -t $(CURRENT_DIR)/build/template.yaml --stack-name $(STACKPREFIX)-$@-$(ENV) --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides $(PARAMETER_OVERRIDES) --config-env $@ --guided

publisherhelper-stack: PARAMETER_OVERRIDES += 'ImageName=${IMAGENAME}'
publisherhelper-stack: push-build
	sam deploy -t $(CURRENT_DIR)/build/template.yaml --stack-name $(STACKPREFIX)-$@-$(ENV) --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides $(PARAMETER_OVERRIDES) --config-env $@ --guided



clean: ## clears the build directory
	@rm -rf build/*


.PHONY: install package publish clean

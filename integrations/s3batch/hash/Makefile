all: help checkenv

help:
	@echo 'deploys MediaExchange transfer utility cloudformation templates'

GUIDED ?= --guided
VERSION ?= latest
ENV ?= dev

STACKPREFIX = mediaexchange-integrations-hash
CURRENT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
IMAGENAME = mediaexchange-integrations-hash/aws-cli
ACCOUNT_ID = $(shell aws sts get-caller-identity --query Account --output text)

PARAMETER_OVERRIDES := Environment=$(ENV)
AWS_REGION ?= $(shell aws configure get region --output text)

configure:
	@mkdir -p build

build:
	@echo "Building docker image..."
	docker build -t $(IMAGENAME):$(VERSION) hasher/

%-build: deployment/%.yaml configure
	@echo "Building lambda..."
	@sam build -s $(CURRENT_DIR) -b $(CURRENT_DIR)/build --template $(CURRENT_DIR)/$< --use-container  $(DEBUG)

%-stack: deployment/%.yaml
	@echo "deploying cloudformation template"
	sam deploy -t $(CURRENT_DIR)/$< --stack-name $(STACKPREFIX)-$@-$(ENV) --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides $(PARAMETER_OVERRIDES) --config-env $@ $(GUIDED) --region $(AWS_REGION)

publish: configure build
	@echo "Publishing Docker image to registry..."
	@aws ecr get-login-password | docker login --username AWS --password-stdin $(ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com

	docker tag ${IMAGENAME}:latest $(ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com/${IMAGENAME}:${VERSION}
	docker push $(ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com/${IMAGENAME}:${VERSION}

package: repository-stack publish

repository-stack:	PARAMETER_OVERRIDES += 'RepositoryName=${IMAGENAME}'

hash-stack: PARAMETER_OVERRIDES += 'ImageName=$(ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com/$(IMAGENAME) DestinationBucketName=$(DestinationBucketName)'
hash-stack: hash-build
	sam deploy -t $(CURRENT_DIR)/build/template.yaml --stack-name $(STACKPREFIX)-$@-$(ENV) --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides $(PARAMETER_OVERRIDES) --config-env $@ $(GUIDED) --region $(AWS_REGION) --config-file $(CURRENT_DIR)/deployment/samconfig.toml

install: hash-stack

#
# publisherhelper-stack: PARAMETER_OVERRIDES += 'ImageName=${IMAGENAME}'
# publisherhelper-stack: push-build
# 	sam deploy -t $(CURRENT_DIR)/build/template.yaml --stack-name $(STACKPREFIX)-$@-$(ENV) --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides $(PARAMETER_OVERRIDES) --config-env $@ --guided

clean: ## clears the build directory
	@rm -rf build/*

.PHONY: install package publish clean build

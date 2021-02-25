all: help

help:
	@echo 'deploys MediaSync transfer utility'

GUIDED ?= --guided
IMAGEVERSION ?= latest
ENV ?= dev

STACKPREFIX = mediaexchange-tools
CURRENT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
IMAGENAME = mediasync/aws-cli
ACCOUNT_ID = $(shell aws sts get-caller-identity --query Account --output text)

PARAMETER_OVERRIDES := Environment=$(ENV)
AWS_REGION ?= $(shell aws configure get region --output text)

configure:
	@mkdir -p build

build:
	@echo "Building docker image..."
	docker build -t $(IMAGENAME):$(IMAGEVERSION) copier/

%-build: deployment/%.yaml configure
	@echo "Building lambda..."
	@sam build -s $(CURRENT_DIR) -b $(CURRENT_DIR)/build --template $(CURRENT_DIR)/$< --use-container  $(DEBUG)

%-stack: deployment/%.yaml
	@echo "deploying cloudformation template"
	sam deploy -t $(CURRENT_DIR)/$< --stack-name $(STACKPREFIX)-$*-$(ENV) --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides $(PARAMETER_OVERRIDES) --config-env $* $(GUIDED) --region $(AWS_REGION)

push: configure build
	@echo "Publishing Docker image to registry..."
	@aws ecr get-login-password | docker login --username AWS --password-stdin $(ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com

	docker tag ${IMAGENAME}:latest $(ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com/${IMAGENAME}:${IMAGEVERSION}
	docker push $(ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com/${IMAGENAME}:${IMAGEVERSION}

publish: mediasync-repository-stack push
mediasync-repository-stack:	PARAMETER_OVERRIDES += 'RepositoryName=${IMAGENAME}'

# mediasync-stack: PARAMETER_OVERRIDES += 'ImageName=$(ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com/$(IMAGENAME) DestinationBucketName=$(DestinationBucketName)'
mediasync-stack: mediasync-build
	sam deploy -t $(CURRENT_DIR)/build/template.yaml --stack-name $(STACKPREFIX)-mediasync-$(ENV) --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides $(PARAMETER_OVERRIDES) --config-env mediasync $(GUIDED) --region $(AWS_REGION) --config-file $(CURRENT_DIR)/deployment/samconfig.toml

install: mediasync-stack

clean: ## clears the build directory
	@rm -rf build/*

.PHONY: install package publish clean build

all: help

help:
	@echo 'deploys fixity utility'

GUIDED ?= --guided
IMAGEVERSION ?= latest
ENV ?= dev

STACKPREFIX = mediaexchange-tools
CURRENT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
IMAGENAME = fixity/hasher
ACCOUNT_ID = $(shell aws sts get-caller-identity --query Account --output text)

PARAMETER_OVERRIDES := Environment=$(ENV)
AWS_REGION ?= $(shell aws configure get region --output text)
SAM_CONFIG_FILE ?= $(CURRENT_DIR)deployment/samconfig-$(ACCOUNT_ID).toml

configure:
	@mkdir -p build

build:
	@echo "Building docker image..."
	docker build -t $(IMAGENAME):$(IMAGEVERSION) hasher/

%-build: deployment/%.yaml configure
	@echo "Building lambda..."
	@sam build -s $(CURRENT_DIR) -b $(CURRENT_DIR)/build --template $(CURRENT_DIR)$< --use-container  $(DEBUG)

%-stack: deployment/%.yaml
	@echo "deploying cloudformation template"
	sam deploy -t $(CURRENT_DIR)$< --stack-name $(STACKPREFIX)-$*-$(ENV) --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides $(PARAMETER_OVERRIDES) --config-env $* $(GUIDED) --region $(AWS_REGION) --config-file $(SAM_CONFIG_FILE)

push: configure build
	@echo "Publishing Docker image to registry..."
	@aws ecr get-login-password | docker login --username AWS --password-stdin $(ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com

	docker tag ${IMAGENAME}:latest $(ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com/${IMAGENAME}:${IMAGEVERSION}
	docker push $(ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com/${IMAGENAME}:${IMAGEVERSION}

publish: fixity-repository-stack push
fixity-repository-stack:	PARAMETER_OVERRIDES += 'RepositoryName=${IMAGENAME}'

fixity-stack: PARAMETER_OVERRIDES += 'ImageName=$(ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com/$(IMAGENAME)'
fixity-stack: fixity-build
	sam deploy -t $(CURRENT_DIR)build/template.yaml --stack-name $(STACKPREFIX)-fixity-$(ENV) --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides $(PARAMETER_OVERRIDES) --config-env fixity $(GUIDED) --region $(AWS_REGION) --config-file $(SAM_CONFIG_FILE)

install: publish fixity-stack

clean: ## clears the build directory
	@rm -rf build/*

.PHONY: install package publish clean build

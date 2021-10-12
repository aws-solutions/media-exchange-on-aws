all: help

help:
	@echo 'deploys AutoIngest utility'

GUIDED ?= --guided
IMAGEVERSION ?= latest
ENV ?= dev

STACKPREFIX = mediaexchange-tools
CURRENT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
IMAGENAME = mediasync/aws-cli
ACCOUNT_ID = $(shell aws sts get-caller-identity --query Account --output text)

PARAMETER_OVERRIDES := Environment=$(ENV)
AWS_REGION ?= $(shell aws configure get region --output text)
SAM_CONFIG_FILE ?= $(CURRENT_DIR)deployment/samconfig-$(ACCOUNT_ID).toml

configure:
	@mkdir -p build

%-build: deployment/%.yaml configure
	@echo "Building lambda..."
	@sam build -s $(CURRENT_DIR) -b $(CURRENT_DIR)/build --template $(CURRENT_DIR)/$< --use-container  $(DEBUG)

autoingest-stack: autoingest-build
	sam deploy -t $(CURRENT_DIR)/build/template.yaml --stack-name $(STACKPREFIX)-autoingest-$(ENV) --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --config-env autoingest $(GUIDED) --region $(AWS_REGION) --parameter-overrides $(PARAMETER_OVERRIDES) --config-file $(SAM_CONFIG_FILE)

install: autoingest-stack

clean: ## clears the build directory
	@rm -rf build/*
	aws cloudformation delete-stack --stack-name $(STACKPREFIX)-autoingest-$(ENV)
	aws cloudformation wait stack-delete-complete --stack-name $(STACKPREFIX)-autoingest-$(ENV)

.PHONY: install clean build

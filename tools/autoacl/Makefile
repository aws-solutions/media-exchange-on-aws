all: help

help:
	@echo 'deploys AutoACL utility'

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

autoacl-stack: autoacl-build
	sam deploy -t $(CURRENT_DIR)/build/template.yaml --stack-name $(STACKPREFIX)-autoacl-$(ENV) --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --config-env autoacl $(GUIDED) --region $(AWS_REGION) --config-file $(SAM_CONFIG_FILE)

install: autoacl-stack

clean: ## clears the build directory
	@rm -rf build/*
	aws cloudformation delete-stack --stack-name $(STACKPREFIX)-autoacl-$(ENV)
	aws cloudformation wait stack-delete-complete --stack-name $(STACKPREFIX)-autoacl-$(ENV)


.PHONY: install clean

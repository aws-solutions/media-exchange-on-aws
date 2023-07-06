all: help

help:
	@echo 'deploys AutoIngest utility'

GUIDED ?= --guided
IMAGEVERSION ?= latest
ENV ?= dev
VERSION ?= 1.2.0


STACKPREFIX = mediaexchange-tools
CURRENT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
IMAGENAME = mediasync/aws-cli
ACCOUNT_ID = $(shell aws sts get-caller-identity --query Account --output text)

PARAMETER_OVERRIDES := Environment=$(ENV)
AWS_REGION ?= $(shell aws configure get region --output text)

configure:
	@mkdir -p build

%-build: deployment/%.json configure
	@echo "Building lambda..."
	@sam build -s $(CURRENT_DIR) -b $(CURRENT_DIR)/build --template $(CURRENT_DIR)/$< --use-container  $(DEBUG)

	@sed -i -e "s/__VERSION__/$(VERSION)/g" $(CURRENT_DIR)/build/template.yaml

autoingest-stack: autoingest-build
	sam deploy -t $(CURRENT_DIR)/build/template.yaml --stack-name $(STACKPREFIX)-autoingest-$(ENV) --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --config-env autoingest $(GUIDED) --region $(AWS_REGION) --parameter-overrides $(PARAMETER_OVERRIDES)

install: autoingest-stack

clean: ## clears the build directory
	@rm -rf build/*
	aws cloudformation delete-stack --stack-name $(STACKPREFIX)-autoingest-$(ENV)
	aws cloudformation wait stack-delete-complete --stack-name $(STACKPREFIX)-autoingest-$(ENV)

.PHONY: install clean build

all: help checkenv

help:
	@echo 'deploys Media Exchange managed transfer utility cloudformation templates'

DEBUG ?=

VERSION ?= latest
ENV ?= dev
STACKPREFIX = mediaexchange-managed-transfer
CURRENT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))


ndef = $(if $(value $(1)),,$(error $(1) not set))
checkenv: ## checks environment
	$(call ndef,AWS_REGION)
	$(call ndef,CFNBUCKET)

configure: checkenv
	@mkdir -p build

%.template: deployment/% configure ## packages cloudformation
	@echo packaging $@
	@aws --region $(AWS_REGION) cloudformation package --template-file $(CURRENT_DIR)/$< --output-template-file $(CURRENT_DIR)/build/$@  --s3-bucket $(CFNBUCKET) --s3-prefix scratch --force-upload $(DEBUG) 1>/dev/null

%: %.yaml.template
	@echo starting deployment of $@ at $(AWS_REGION)
	@aws --region $(AWS_REGION) cloudformation deploy --template-file $(CURRENT_DIR)/build/$< --stack-name $(STACKPREFIX)-$@-$(ENV)-stack --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM  $(DEBUG) 1>/dev/null

install: package network batch
	$(call ndef,DESTINATION_BUCKET)
	@sam deploy --template-file $(CURRENT_DIR)/build/template.yaml --stack-name $(STACKPREFIX)-s3job-$(ENV)-stack --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM  --s3-bucket $(CFNBUCKET) --s3-prefix scratch --force-upload --parameter-overrides DestinationBucket=$(DESTINATION_BUCKET) $(DEBUG) 1>/dev/null

package:
	$(MAKE) -C copier publish

	@sam build -s $(CURRENT_DIR) -b $(CURRENT_DIR)/build --template $(CURRENT_DIR)/deployment/s3job.yaml --use-container  $(DEBUG) 1>/dev/null



clean: ## clears the build directory
	@rm -rf build/*

.PHONY: checkenv configure install clean package

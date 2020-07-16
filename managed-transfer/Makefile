all: help checkenv

help:
	@echo 'deploys Media Exchange managed transfer utility cloudformation templates'

DEBUG ?=

VERSION ?= latest
ENV ?= dev
STACKPREFIX = mediaexchange-managedtransfer
CURRENT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))


ndef = $(if $(value $(1)),,$(error $(1) not set))
checkenv: ## checks environment
	$(call ndef,AWS_REGION)

%: deployment/%.yaml checkenv
	@echo starting deployment of $@ at $(AWS_REGION)
	@aws --region $(AWS_REGION) cloudformation deploy --template-file $(CURRENT_DIR)deployment/$@.yaml --stack-name $(STACKPREFIX)-$@-$(ENV)-stack --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides Environment=$(ENV) $(DEBUG) 1>/dev/null


package: checkenv
	$(MAKE) -C copier publish

install: network batch

publisherhelper:
	$(MAKE) -C $(CURRENT_DIR)integrations/s3job push

subscriberhelper:
	$(MAKE) -C $(CURRENT_DIR)integrations/s3job pull

bashhelper:
	$(MAKE) -C $(CURRENT_DIR)integrations/bash install


.PHONY: checkenv install package

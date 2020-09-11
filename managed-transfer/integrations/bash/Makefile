all: help checkenv

help:
	@echo 'deploys Media Exchange managed transfer shell script integration'

DEBUG ?=

ENV ?= dev
STACKPREFIX = mediaexchange-managedtransfer
CURRENT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

ndef = $(if $(value $(1)),,$(error $(1) not set))

install: deployment/job.yaml

	@echo deploying bashhelper at $(AWS_REGION)
	@aws --region $(AWS_REGION) cloudformation deploy --template-file $(CURRENT_DIR)deployment/job.yaml --stack-name $(STACKPREFIX)-bash-$(ENV)-stack --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides Environment=$(ENV) $(DEBUG) 1>/dev/null

.PHONY: install

all: help checkenv

help:
	@echo 'deploys Media Exchange managed transfer utility''s custom container image'

DEBUG ?=

VERSION ?= latest
STACKPREFIX = mediaexchange-managedtransfer
NAME = ${STACKPREFIX}/aws-cli

CURRENT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
ACCOUNTID := $(shell aws sts get-caller-identity --query Account --output text)

ndef = $(if $(value $(1)),,$(error $(1) not set))
checkenv: ## checks environment
	$(call ndef,AWS_REGION)

repository: checkenv
	@echo starting deployment of $@ at $(AWS_REGION)
	@aws --region $(AWS_REGION) cloudformation deploy --template-file $(CURRENT_DIR)/repository.yaml --stack-name $(STACKPREFIX)-$@-stack --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides RepositoryName=$(NAME) $(DEBUG) 1>/dev/null

image:
	@echo "Building docker image..."
	docker build -t $(NAME):$(VERSION) .

publish: image repository
	@echo "Publishing Docker image to registry..."
	aws ecr get-login-password --region $(AWS_REGION) | docker login --username AWS --password-stdin $(ACCOUNTID).dkr.ecr.$(AWS_REGION).amazonaws.com

	docker tag ${NAME}:latest $(ACCOUNTID).dkr.ecr.$(AWS_REGION).amazonaws.com/${NAME}:${VERSION}
	docker push $(ACCOUNTID).dkr.ecr.$(AWS_REGION).amazonaws.com/${NAME}:${VERSION}

.PHONY: checkenv install publish image

all: help checkenv

help:
	@echo 'deploys Media Exchange managed transfer utility''s custom container image'

DEBUG ?=

VERSION ?= latest
ENV ?= dev
STACKPREFIX = mediaexchange-managed-transfer
NAME = ${STACKPREFIX}/aws-cli

CURRENT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
ACCOUNTID := $(shell aws sts get-caller-identity --query Account --output text)

ndef = $(if $(value $(1)),,$(error $(1) not set))
checkenv: ## checks environment
	$(call ndef,AWS_REGION)
	$(call ndef,CFNBUCKET)

configure: checkenv
	@mkdir -p $(CURRENT_DIR)/build

repository.yaml.template: repository.yaml configure ## packages cloudformation
	@echo packaging $@
	@aws --region $(AWS_REGION) cloudformation package --template-file $< --output-template-file $(CURRENT_DIR)/build/$@  --s3-bucket $(CFNBUCKET) --s3-prefix scratch --force-upload $(DEBUG) 1>/dev/null

repository: repository.yaml.template
	@echo starting deployment of $@ at $(AWS_REGION)
	@aws --region $(AWS_REGION) cloudformation deploy --template-file $(CURRENT_DIR)/build/$< --stack-name $(STACKPREFIX)-$@-$(ENV)-stack --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides RepositoryName=$(NAME) $(DEBUG) 1>/dev/null

image:
	@echo "Building docker image..."
	docker build -t $(NAME):$(VERSION) - < $(CURRENT_DIR)/Dockerfile

publish: image repository
	@echo "Publishing Docker image to registry..."
	aws ecr get-login-password --region $(AWS_REGION) | docker login --username AWS --password-stdin $(ACCOUNTID).dkr.ecr.$(AWS_REGION).amazonaws.com

	docker tag ${NAME}:latest $(ACCOUNTID).dkr.ecr.$(AWS_REGION).amazonaws.com/${NAME}:${VERSION}
	docker push $(ACCOUNTID).dkr.ecr.$(AWS_REGION).amazonaws.com/${NAME}:${VERSION}


clean: ## clears the build directory
	@rm -rf $(CURRENT_DIR)/build/*

.PHONY: checkenv configure install clean

# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

all: help

help:
	@echo 'deploys MediaSync transfer utility'

GUIDED ?= --guided
IMAGEVERSION ?= latest
ENV ?= dev
VERSION ?= 1.1.0


STACKPREFIX = mediaexchange-tools
CURRENT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
IMAGENAME = mediasync/aws-cli
ACCOUNT_ID = $(shell aws sts get-caller-identity --query Account --output text)

PARAMETER_OVERRIDES := Environment=$(ENV)
AWS_REGION ?= $(shell aws configure get region --output text)
SAM_CONFIG_FILE ?= $(CURRENT_DIR)deployment/samconfig-$(ACCOUNT_ID).toml

configure:
	@mkdir -p build

%-image-build:
	@echo "Building docker image..."
	docker buildx build --platform=linux/amd64 -t $(IMAGENAME):$(IMAGEVERSION) copier/

%-image-push: %-image-build
	@echo "Publishing Docker image to registry..."
	@aws ecr get-login-password | docker login --username AWS --password-stdin $(ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com

	docker tag ${IMAGENAME}:latest $(ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com/${IMAGENAME}:${IMAGEVERSION}
	docker push $(ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com/${IMAGENAME}:${IMAGEVERSION}

%-stack-build: deployment/%.yaml configure
	@echo "Building template..."
	@sam build -s $(CURRENT_DIR) -b $(CURRENT_DIR)/build/$*/ --template $(CURRENT_DIR)/$< --use-container

	@sed -i -e "s/__VERSION__/$(VERSION)/g" $(CURRENT_DIR)/build/$*/template.yaml


%-stack-install: %-stack-build
	@echo "deploying cloudformation template"
	sam deploy -t $(CURRENT_DIR)/build/$*/template.yaml --stack-name $(STACKPREFIX)-$*-$(ENV) --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameter-overrides $(PARAMETER_OVERRIDES) --config-env $* $(GUIDED) --region $(AWS_REGION) --config-file $(SAM_CONFIG_FILE)

%-stack-delete:
	@echo "deleting cloudformation stack"
	aws cloudformation delete-stack --stack-name $(STACKPREFIX)-$*-$(ENV)
	aws cloudformation wait stack-delete-complete --stack-name $(STACKPREFIX)-$*-$(ENV)

%-repository-clean:
	@echo "Cleaning docker images from registry..."
	for tag in $(shell aws ecr list-images --repository-name $* --query "imageIds[].imageDigest" --output text); do \
		aws ecr batch-delete-image --repository-name $* --image-ids imageDigest=$$tag; \
	done

mediasync-repository-stack-install:	PARAMETER_OVERRIDES += 'RepositoryName=${IMAGENAME}'

mediasync-stack-install: PARAMETER_OVERRIDES += 'ImageName=$(ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com/$(IMAGENAME)'

publish: mediasync-repository-stack-install $(IMAGENAME)-image-push
install: mediasync-repository-stack-install $(IMAGENAME)-image-push mediasync-stack-install

clean: mediasync-stack-delete $(IMAGENAME)-repository-clean mediasync-repository-stack-delete
	@rm -rf build/*

.PHONY: configure install clean

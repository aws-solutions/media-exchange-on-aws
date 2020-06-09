all: help checkenv

help: 
	@echo 'deploys Media Exchange cloudformation templates. It uses AWS credentials to deploy the stacks. It checks if the credentials are set by AWS_ACC* environment variables.'

VERSION ?= latest
ENV ?= dev
STACKPREFIX = mxc
CFNBUCKET ?= change_me 


ndef = $(if $(value $(1)),,$(error $(1) not set))
checkenv: ## checks environment
	$(call ndef,AWS_REGION)
	$(call ndef,AWS_REGION)
	$(call ndef,CFNBUCKET)
	@command -v aws >/dev/null 2>&1 || ( echo >&2 "awscli is not installed. Please see install guide here: https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html"; exit 1; )
    
configure: checkenv
	@mkdir -p build

%.template: deployment/% ## packages cloudformation
	@echo packaging $@
	@aws --region $(AWS_REGION) cloudformation package --template-file $< --output-template-file build/$@  --s3-bucket $(CFNBUCKET) 1>/dev/null
	
core: core.yaml.template ## deploys core
	@echo deploying $@ at $(AWS_REGION)
	@aws --region $(AWS_REGION) cloudformation deploy --template-file build/$< --stack-name $(STACKPREFIX)-core-$(ENV)-stack --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --s3-bucket $(CFNBUCKET) 1>/dev/null


publisher: publisher.yaml.template ## deploys a publisher
	$(call ndef,PUBLISHER_NAME)
	$(call ndef,PUBLISHER_ACCOUNT_ID)

	@echo deploying $@ at $(AWS_REGION)
	@aws --region $(AWS_REGION) cloudformation deploy --template-file build/$< --stack-name $(STACKPREFIX)-publisher-$(PUBLISHER_NAME)-$(ENV)-stack --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --s3-bucket $(CFNBUCKET) --parameter-overrides PublisherAccountId=$(PUBLISHER_ACCOUNT_ID) 1>/dev/null


subscriber: subscriber.yaml.template ## deploys a subscriber
	$(call ndef,SUBSCRIBER_NAME)
	$(call ndef,SUBSCRIBER_ACCOUNT_ID)
	$(call ndef,SUBSCRIBER_CANNONICAL_ACCOUNT_ID)
	$(call ndef,SUBSCRIBER_EMAIL)

	@echo deploying $@ at $(AWS_REGION)
	@aws --region $(AWS_REGION) cloudformation deploy --template-file build/$< --stack-name $(STACKPREFIX)-subscriber-$(SUBSCRIBER_NAME)-$(ENV)-stack --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --s3-bucket $(CFNBUCKET) --parameter-overrides SubscriberAccountId=$(SUBSCRIBER_ACCOUNT_ID) CannonicalAccountID=$(SUBSCRIBER_CANNONICAL_ACCOUNT_ID) Email=$(SUBSCRIBER_EMAIL) Prefix=$(SUBSCRIBER_NAME) 1>/dev/null

agreement: agreement.yaml.template ## deploys an agreement
	$(call ndef,SUBSCRIBER_NAME)
	$(call ndef,SUBSCRIBER_ACCOUNT_ID)
	$(call ndef,PUBLISHER_NAME)
	$(call ndef,PUBLISHER_ACCOUNT_ID)

	@echo deploying $@ at $(AWS_REGION)
	@aws --region $(AWS_REGION) cloudformation deploy --template-file build/$< --stack-name $(STACKPREFIX)-agreement-$(PUBLISHER_NAME)-$(SUBSCRIBER_NAME)-$(ENV)-stack --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --s3-bucket $(CFNBUCKET) --parameter-overrides SubscriberAccountId=$(SUBSCRIBER_ACCOUNT_ID) PublisherAccountId=$(PUBLISHER_ACCOUNT_ID) 1>/dev/null


clean: ## clears the build directory
	@rm -rf build/*

.PHONY: checkenv configure
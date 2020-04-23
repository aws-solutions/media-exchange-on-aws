all: clean configure deploy

version ?= latest
env ?= dev
name = mxc

ifndef AWS_REGION
$(error AWS_REGION is not set)
endif


artifactbucket = mxc-artifacts-${env}-${AWS_REGION}-$(shell aws sts get-caller-identity --query Account --output text)

configure:
	@command -v aws >/dev/null 2>&1 || { echo >&2 "awscli is not installed. Please see install guide here: https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html"; exit 1; }
	@mkdir -p build

# packages cloudformation
%.template: deployment/% 
	@echo packaging $@
	@aws --region ${AWS_REGION} cloudformation package --template-file $< --output-template-file build/$@  --s3-bucket ${artifactbucket} 1>/dev/null
	
${name}-%-${env}-stack: %.yaml.template
	@echo deploying $@
	@aws --region ${AWS_REGION} cloudformation deploy --template-file build/$< --stack-name $@ --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --s3-bucket ${artifactbucket} 1>/dev/null

deploy: ${name}-core-${env}-stack

# Samples
# make publisher NAME=1 PARAMETERS="PublisherAccountId=702582666339 Email=prodey+publisher@amazon.com"
# make subscriber NAME=1 PARAMETERS="SubscriberAccountId=818349722120 Email=prodey+subscriber@amazon.com Prefix=One/ CannonicalAccountID=73bdba08d78f9958eda14541b6bbe42178fcdd767cc1502b5ee397f3687efcac"
# make agreement NAME=1-1 PARAMETERS="PublisherAccountId=702582666339 SubscriberAccountId=818349722120"

%: %.yaml.template
	@echo deploying $@ with ${PARAMETERS}
	@aws --region ${AWS_REGION} cloudformation deploy --template-file build/$< --stack-name ${name}-$@-${NAME}-${env}-stack --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --s3-bucket ${artifactbucket} --parameter-overrides ${PARAMETERS} 1>/dev/null

clean:
	@rm -rf build/*

.PHONY: configure build clean
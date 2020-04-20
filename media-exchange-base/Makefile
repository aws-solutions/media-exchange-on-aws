all: clean configure deploy

version ?= latest
env ?= dev
name = mxc-base
region ?= us-east-2

artifactbucket = mxc-artifacts-${env}-${region}-$(shell aws sts get-caller-identity --query Account --output text)

configure:
	@command -v aws >/dev/null 2>&1 || { echo >&2 "awscli is not installed. Please see install guide here: https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html"; exit 1; }
	@mkdir -p build

# packages cloudformation
%.template: deployment/% 
	@echo packaging $@
	@aws --region ${region} cloudformation package --template-file $< --output-template-file build/$@  --s3-bucket ${artifactbucket} 1>/dev/null
	
${name}-%-${env}-stack: %.yaml.template
	@echo deploying $@
	@aws --region ${region} cloudformation deploy --template-file build/$< --stack-name $@ --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --s3-bucket ${artifactbucket} 1>/dev/null

deploy: ${name}-storage-${env}-stack

## make producer PARAMETERS='AWSAccountID=123456.. Email=change@me.com'
## make consumer AWS_ACCOUNT_ID=123456.. PARAMETERS='CannonicalAccountID=abcdef12355.. Email=change@me.com'
## make agreement PARAMETERS='ProducerAccountId=123456.. ConsumerAccountId=1234556..'

%: %.yaml.template
	@echo deploying $@ with ${PARAMETERS}
	@aws --region ${region} cloudformation deploy --template-file build/$< --stack-name ${name}-$@-${AWS_ACCOUNT_ID}-${env}-stack --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --s3-bucket ${artifactbucket} --parameter-overrides ${PARAMETERS} 1>/dev/null

clean:
	@rm -rf build/*

.PHONY: configure build clean
#######################################################################################################################
#  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                                 #
#                                                                                                                     #
#  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance     #
#  with the License. A copy of the License is located at                                                              #
#                                                                                                                     #
#      http://www.apache.org/licenses/LICENSE-2.0                                                                     #
#                                                                                                                     #
#  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES  #
#  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions     #
#  and limitations under the License.                                                                                 #
#######################################################################################################################
import json
import os
import unittest
import boto3
import mock
import pytest
from moto import mock_s3, mock_batch, mock_iam, mock_ec2
from botocore.exceptions import ClientError

S3_BUCKET_NAME = 'buckettestname'
DEFAULT_REGION = 'us-east-1'
S3_TEST_FILE_KEY = 'BigBunnySample.mp4'
S3_TEST_FILE_CONTENT = [
    {"company": "amazon", "price": 15},
    {"company": "test", "price": 25}
]
awsSolutionId = 'AwsSolution/SO0133/1.1.0'
invocationId = 'test-invocation-id'
taskId = 'test-task-id'

@mock_batch
@mock_ec2
@mock_s3
@mock_iam
class TestFixityLambdaFunction(unittest.TestCase):
    def setUp(self):
        # S3 setup
        self.s3 = boto3.resource('s3', region_name=DEFAULT_REGION) 
        self.s3_bucket = self.s3.create_bucket(Bucket=S3_BUCKET_NAME)
        self.s3.BucketVersioning(S3_BUCKET_NAME).enable()
        self.s3_bucket.put_object(Key=S3_TEST_FILE_KEY,
                                  Body=json.dumps(S3_TEST_FILE_CONTENT)) # Emulate file in ME bucket
        self.S3_TEST_FILE_VERSION = self.s3.Bucket(S3_BUCKET_NAME).Object(S3_TEST_FILE_KEY).version_id # Save file version

        client = boto3.client("batch")
        iam = boto3.resource("iam")
        service_role = iam.create_role(
            RoleName="BatchServiceRole", AssumeRolePolicyDocument="AWSBatchServiceRole"
        )
        instance_profile = iam.create_instance_profile(
            InstanceProfileName="InstanceProfile"
        )
        instance_profile.add_role(RoleName=service_role.name)
        
        ec2 = boto3.resource("ec2", region_name=DEFAULT_REGION) 
        vpc = ec2.create_vpc(CidrBlock="172.16.0.0/16")  # NOSONAR
        vpc.wait_until_available()
        subnet = ec2.create_subnet(CidrBlock="172.16.0.1/24", VpcId=vpc.id)  # NOSONAR

        response = client.create_compute_environment(
            computeEnvironmentName="compute_environment",
            type="UNMANAGED",
            state="ENABLED",
            serviceRole=service_role.arn,
        )

        compute_environment_arn = response.get('computeEnvironmentArn')

        # aws-batch job queue mock
        job_qs = client.create_job_queue(
            jobQueueName='test_job_q',
            state='ENABLED',
            priority=1,
            computeEnvironmentOrder=[
                {
                    'order': 1,
                    'computeEnvironment': compute_environment_arn
                },
            ]
        )
        self.job_q_arn = job_qs.get('jobQueueArn')
       
        # aws-batch job definition mock
        job_definition = client.register_job_definition(
            jobDefinitionName='test_job_definition',
            type='container',
            containerProperties={
                'image': 'string',
                'vcpus': 123,
                'memory': 123
            },
        )
        self.job_definition_arn = job_definition.get('jobDefinitionArn')
        

    def test_submit_job_success(self):
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', "JOB_QUEUE": self.job_q_arn, "JOB_SIZE_SMALL": self.job_definition_arn, "JOB_SIZE_LARGE": self.job_definition_arn, 'JOB_SIZE_THRESHOLD': '10737418240', 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': awsSolutionId}):
            from fixity_driver.app import _submit_job
            file_content = _submit_job(S3_BUCKET_NAME, S3_TEST_FILE_KEY)
            self.assertEqual(type(file_content), str)
    
    def test_submit_job_error(self):
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', "JOB_QUEUE": self.job_q_arn, "JOB_SIZE_SMALL": self.job_definition_arn, "JOB_SIZE_LARGE": self.job_definition_arn, 'JOB_SIZE_THRESHOLD': '10737418240', 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': awsSolutionId}):
            from fixity_driver.app import _submit_job
            self.assertRaises(ClientError, _submit_job, S3_TEST_FILE_KEY, S3_BUCKET_NAME)

    def test_s3_batch_handler_success(self):
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', "JOB_QUEUE": self.job_q_arn, "JOB_SIZE_SMALL": self.job_definition_arn, "JOB_SIZE_LARGE": self.job_definition_arn, 'JOB_SIZE_THRESHOLD': '10737418240', 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': awsSolutionId, 'AWS_REGION': 'us-east-1'}):
            from fixity_driver.app import s3_batch_handler
            event = {'invocationId': invocationId, 'job': {'id': '9357a3a7-5e34-4fa9-a1df-e1a4299b90b7'}, 'tasks': [{'taskId': 'taskId', 's3BucketArn': 'arn:aws:s3:::buckettestname', 's3Key': S3_TEST_FILE_KEY, 's3VersionId': None}], 'invocationSchemaVersion': '1.0'}
            file_content = s3_batch_handler(event, '_')
            self.assertEqual(file_content.get('results')[0].get('resultCode'), 'Succeeded')

    def test_s3_batch_handler_error(self):
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', "JOB_QUEUE": self.job_q_arn, "JOB_SIZE_SMALL": self.job_definition_arn, "JOB_SIZE_LARGE": self.job_definition_arn, 'JOB_SIZE_THRESHOLD': '10737418240', 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': awsSolutionId, 'AWS_REGION': 'us-east-1'}):
            from fixity_driver.app import s3_batch_handler
            event = {'invocationId': invocationId, 'job': {'id': '9357a3a7-5e34-4fa9-a1df-e1a4299b90b7'}, 'tasks': [{'taskId': 'taskId', 's3BucketArn': 'arn:aws:s3:::buckettestname', 's3Key': 'BigBunnySamp.mp4', 's3VersionId': None}], 'invocationSchemaVersion': '1.0'}
            file_content = s3_batch_handler(event, '_')
            self.assertEqual(file_content, {'invocationSchemaVersion': '1.0', 'treatMissingKeysAs': 'PermanentFailure', 'invocationId': invocationId, 'results': [{'taskId': 'taskId', 'resultCode': 'PermanentFailure', 'resultString': '404: Not Found'}]})

    def test_s3_api_handler_success(self):
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', "JOB_QUEUE": self.job_q_arn, "JOB_SIZE_SMALL": self.job_definition_arn, "JOB_SIZE_LARGE": self.job_definition_arn, 'JOB_SIZE_THRESHOLD': '10737418240', 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': awsSolutionId, 'AWS_REGION': 'us-east-1'}):
            from fixity_driver.app import api_handler
            event = {'queryStringParameters': {'bucket': 'buckettestname', 'key': S3_TEST_FILE_KEY}, 'invocationId': invocationId,'invocationSchemaVersion': '1.0'}
            file_content = api_handler(event, '_')
            self.assertEqual(file_content.get('statusCode'), 400)

    def test_s3_api_handler_error(self):
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', "JOB_QUEUE": self.job_q_arn, "JOB_SIZE_SMALL": self.job_definition_arn, "JOB_SIZE_LARGE": self.job_definition_arn, 'JOB_SIZE_THRESHOLD': '10737418240', 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': awsSolutionId, 'AWS_REGION': 'us-east-1'}):
            from fixity_driver.app import api_handler
            event = {'queryStringParameters': {'bucket': 'buckettestname', 'key': 'BigBunnySamp.mp4'}, 'invocationId': invocationId,'invocationSchemaVersion': '1.0'}
            file_content = api_handler(event, '_')
            self.assertEqual(file_content, {'statusCode': 500, 'body': '{"Error": {"Code": "404", "Message": "Not Found"}}'})
            


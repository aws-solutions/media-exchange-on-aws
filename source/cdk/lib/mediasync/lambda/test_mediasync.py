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
from moto import mock_s3, mock_batch, mock_iam, mock_ec2
from botocore.exceptions import ClientError

S3_BUCKET_NAME = 'buckettestname'
DESTINATION_S3_BUCKET_NAME = 'actualtestbucketname'
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
class TestMediaSyncLambdaFunction(unittest.TestCase):
    def setUp(self):
        # S3 setup
        self.s3 = boto3.resource('s3', region_name=DEFAULT_REGION) 
        self.s3_bucket = self.s3.create_bucket(Bucket=S3_BUCKET_NAME, CreateBucketConfiguration={'LocationConstraint': 'eu-west-1'},)
        self.destination_s3_bucket = self.s3.create_bucket(Bucket=DESTINATION_S3_BUCKET_NAME, CreateBucketConfiguration={'LocationConstraint': 'eu-west-1'}) # Fake ME bucket
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
        

    def test_get_bucket_region_success(self):
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', "JOB_QUEUE": self.job_q_arn, "JOB_SIZE_SMALL": self.job_definition_arn, "JOB_SIZE_LARGE": self.job_definition_arn, 'JOB_SIZE_THRESHOLD': '10737418240', 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': awsSolutionId}):
            from mediasync_driver.app import get_bucket_region
            file_content = get_bucket_region(S3_BUCKET_NAME)
            print(file_content)
            self.assertEqual(file_content, 'eu-west-1')
    
    def test_get_bucket_region_error(self):
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', "JOB_QUEUE": self.job_q_arn, "JOB_SIZE_SMALL": self.job_definition_arn, "JOB_SIZE_LARGE": self.job_definition_arn, 'JOB_SIZE_THRESHOLD': '10737418240', 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': awsSolutionId}):
            from mediasync_driver.app import get_bucket_region
            file_content = get_bucket_region(S3_BUCKET_NAME)
            print(file_content)
            self.assertNotEqual(file_content, DEFAULT_REGION)
    
    def test_pre_flight_check_success(self):
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No'}):
            from mediasync_driver.app import pre_flight_check
            file_content = pre_flight_check(S3_BUCKET_NAME, S3_TEST_FILE_KEY)
            self.assertIsNotNone(file_content.get('ResponseMetadata').get('RequestId'))
    
    def test_pre_flight_check_error(self):
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No'}):
            from mediasync_driver.app import pre_flight_check
            self.assertRaises(ClientError, pre_flight_check, S3_BUCKET_NAME, DEFAULT_REGION)

    def test_check_if_deleted_success(self):
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': awsSolutionId}):
            from mediasync_driver.app import check_if_deleted
            pre_flight_check_input = {'pre_flight_response': False}
            file_content = check_if_deleted(S3_TEST_FILE_KEY, pre_flight_check_input)
            self.assertEqual(file_content, 'Exists')
    
    def test_check_if_deleted_error(self):
       with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': awsSolutionId}):
            from mediasync_driver.app import check_if_deleted
            pre_flight_check_input = {'pre_flight_response': True, 'DeleteMarker': True}
            self.assertRaises(Exception, check_if_deleted, S3_TEST_FILE_KEY, pre_flight_check_input)

    def test_check_if_supported_storage_class_success(self):
       with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': awsSolutionId}):
            from mediasync_driver.app import check_if_supported_storage_class
            pre_flight_check_input = {'pre_flight_response': False}
            file_content = check_if_supported_storage_class(S3_TEST_FILE_KEY, pre_flight_check_input)
            self.assertIsNone(file_content)
    
    def test_check_if_supported_storage_class_error(self):
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': awsSolutionId}):
            from mediasync_driver.app import check_if_supported_storage_class
            pre_flight_check_input = {'pre_flight_response': True, 'DeleteMarker': True, 'StorageClass': 'GLACIER'}
            self.assertRaises(Exception, check_if_supported_storage_class, S3_TEST_FILE_KEY, pre_flight_check_input)

    def test_submit_job_success(self):
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', 'JOB_DEFINITION': self.job_definition_arn,'JOB_DEFINITION_X_REGION': self.job_definition_arn, 'JOB_QUEUE': self.job_q_arn, 'DESTINATION_BUCKET_NAME': DESTINATION_S3_BUCKET_NAME, 'DISABLE_PENDING_JOBS_CHECK': "true", 'MAX_NUMBER_OF_PENDING_JOBS': "96", 'MN_SIZE_FOR_BATCH_IN_BYTES': "524288000", 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': awsSolutionId}):
            from mediasync_driver.app import submit_job
            file_content = submit_job('1', S3_BUCKET_NAME, S3_TEST_FILE_KEY, DESTINATION_S3_BUCKET_NAME, 1000)
            self.assertEqual(type(file_content), str)
    
    def test_submit_job_error(self):
         with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', 'JOB_DEFINITION': self.job_definition_arn,'JOB_DEFINITION_X_REGION': self.job_definition_arn, 'JOB_QUEUE': self.job_q_arn, 'DESTINATION_BUCKET_NAME': DESTINATION_S3_BUCKET_NAME, 'DISABLE_PENDING_JOBS_CHECK': "true", 'MAX_NUMBER_OF_PENDING_JOBS': "96", 'MN_SIZE_FOR_BATCH_IN_BYTES': "524288000", 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': awsSolutionId}):
            from mediasync_driver.app import submit_job
            self.assertRaises(Exception, submit_job, '1', S3_TEST_FILE_KEY, S3_BUCKET_NAME, DESTINATION_S3_BUCKET_NAME, 1000)

    def test_in_place_copy_success(self):
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No'}):
            from mediasync_driver.app import in_place_copy
            file_content = in_place_copy(S3_BUCKET_NAME, S3_TEST_FILE_KEY, DESTINATION_S3_BUCKET_NAME)
            self.assertIsNone(file_content)

    def test_in_place_copy_error(self):
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No'}):
            from mediasync_driver.app import in_place_copy
            self.assertRaises(Exception, in_place_copy, S3_TEST_FILE_KEY, S3_BUCKET_NAME, DESTINATION_S3_BUCKET_NAME)

    def test_is_can_submit_jobs_success(self):
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', 'JOB_DEFINITION': self.job_definition_arn,'JOB_DEFINITION_X_REGION': self.job_definition_arn, 'JOB_QUEUE': self.job_q_arn, 'DESTINATION_BUCKET_NAME': DESTINATION_S3_BUCKET_NAME, 'DISABLE_PENDING_JOBS_CHECK': 'True', 'MAX_NUMBER_OF_PENDING_JOBS': "96", 'MN_SIZE_FOR_BATCH_IN_BYTES': "524288000", 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': awsSolutionId}):
            from mediasync_driver.app import is_can_submit_jobs
            file_content = is_can_submit_jobs()
            self.assertEqual(file_content, True)

    def test_is_can_submit_jobs_error(self):
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', 'JOB_DEFINITION': self.job_definition_arn,'JOB_DEFINITION_X_REGION': self.job_definition_arn, 'JOB_QUEUE': 'self.job_q_arn_one', 'DESTINATION_BUCKET_NAME': DESTINATION_S3_BUCKET_NAME, 'DISABLE_PENDING_JOBS_CHECK': 'False', 'MAX_NUMBER_OF_PENDING_JOBS': "-1", 'MN_SIZE_FOR_BATCH_IN_BYTES': "524288000", 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': awsSolutionId}):
            from mediasync_driver.app import is_can_submit_jobs
            self.assertRaises(Exception, is_can_submit_jobs)

    def test_lambda_handler_success(self):
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', 'JOB_DEFINITION': self.job_definition_arn,'JOB_DEFINITION_X_REGION': self.job_definition_arn, 'JOB_QUEUE': 'self.job_q_arn_two', 'DESTINATION_BUCKET_NAME': DESTINATION_S3_BUCKET_NAME, 'DISABLE_PENDING_JOBS_CHECK': 'False', 'MAX_NUMBER_OF_PENDING_JOBS': "-1", 'MN_SIZE_FOR_BATCH_IN_BYTES': "524288000", 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': awsSolutionId}):
            from mediasync_driver.app import lambda_handler
            event = {'invocationId': invocationId, 'job': {'id': '9357a3a7-5e34-4fa9-a1df-e1a4299b90b7'}, 'tasks': [{'taskId': taskId, 's3BucketArn': 'arn:aws:s3:::buckettestname', 's3Key': 'BigBunnySample.mp4', 's3VersionId': None}], 'invocationSchemaVersion': '1.0'}
            file_content = lambda_handler(event, '_')
            self.assertEqual(file_content.get('results')[0].get('resultCode'), 'Succeeded')

    def test_lambda_handler_error(self):
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', 'JOB_DEFINITION': self.job_definition_arn,'JOB_DEFINITION_X_REGION': self.job_definition_arn, 'JOB_QUEUE': 'self.job_q_arn_three', 'DESTINATION_BUCKET_NAME': DESTINATION_S3_BUCKET_NAME, 'DISABLE_PENDING_JOBS_CHECK': 'False', 'MAX_NUMBER_OF_PENDING_JOBS': "-1", 'MN_SIZE_FOR_BATCH_IN_BYTES': "524288000", 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': awsSolutionId}):
            from mediasync_driver.app import lambda_handler
            event = {'invocationId': invocationId, 'job': {'id': '9357a3a7-5e34-4fa9-a1df-e1a4299b90b7'}, 'tasks': [{'taskId': taskId, 's3BucketArn': 'arn:aws:s3:::buckettestname', 's3Key': 'BigBunnySamp.mp4', 's3VersionId': None}], 'invocationSchemaVersion': '1.0'}
            file_content = lambda_handler(event, '_')
            self.assertEqual(file_content, {'invocationSchemaVersion': '1.0', 'treatMissingKeysAs': 'PermanentFailure', 'invocationId': invocationId, 'results': [{'taskId': taskId, 'resultCode': 'PermanentFailure', 'resultString': '404: Not Found'}]})


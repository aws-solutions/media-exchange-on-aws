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
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', "JOB_QUEUE": self.job_q_arn, "JOB_SIZE_SMALL": self.job_definition_arn, "JOB_SIZE_LARGE": self.job_definition_arn, 'JOB_SIZE_THRESHOLD': '10737418240', 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': 'AwsSolution/SO0133/1.1.0'}):
            from mediasync_driver.app import get_bucket_region
            file_content = get_bucket_region(S3_BUCKET_NAME)
            print(file_content)
            self.assertEqual(file_content, 'eu-west-1')
    
    def test_get_bucket_region_error(self):
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', "JOB_QUEUE": self.job_q_arn, "JOB_SIZE_SMALL": self.job_definition_arn, "JOB_SIZE_LARGE": self.job_definition_arn, 'JOB_SIZE_THRESHOLD': '10737418240', 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': 'AwsSolution/SO0133/1.1.0'}):
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
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': 'AwsSolution/SO0133/1.1.0'}):
            from mediasync_driver.app import check_if_deleted
            pre_flight_check_input = {'pre_flight_response': False}
            file_content = check_if_deleted(S3_TEST_FILE_KEY, pre_flight_check_input)
            self.assertEqual(file_content, 'Exists')
    
    def test_check_if_deleted_error(self):
       with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': 'AwsSolution/SO0133/1.1.0'}):
            from mediasync_driver.app import check_if_deleted
            pre_flight_check_input = {'pre_flight_response': True, 'DeleteMarker': True}
            self.assertRaises(Exception, check_if_deleted, S3_TEST_FILE_KEY, pre_flight_check_input)

    def test_check_if_supported_storage_class_success(self):
       with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': 'AwsSolution/SO0133/1.1.0'}):
            from mediasync_driver.app import check_if_supported_storage_class
            pre_flight_check_input = {'pre_flight_response': False}
            file_content = check_if_supported_storage_class(S3_TEST_FILE_KEY, pre_flight_check_input)
            self.assertEqual(file_content, 'success')
    
    def test_check_if_supported_storage_class_error(self):
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': 'AwsSolution/SO0133/1.1.0'}):
            from mediasync_driver.app import check_if_supported_storage_class
            pre_flight_check_input = {'pre_flight_response': True, 'DeleteMarker': True, 'StorageClass': 'GLACIER'}
            self.assertRaises(Exception, check_if_supported_storage_class, S3_TEST_FILE_KEY, pre_flight_check_input)

    def test_submit_job_success(self):
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', 'JOB_DEFINITION': self.job_definition_arn,'JOB_DEFINITION_X_REGION': self.job_definition_arn, 'JOB_QUEUE': self.job_q_arn, 'DESTINATION_BUCKET_NAME': DESTINATION_S3_BUCKET_NAME, 'DISABLE_PENDING_JOBS_CHECK': "true", 'MAX_NUMBER_OF_PENDING_JOBS': "96", 'MN_SIZE_FOR_BATCH_IN_BYTES': "524288000", 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': 'AwsSolution/SO0133/1.1.0'}):
            from mediasync_driver.app import submit_job
            file_content = submit_job('1', S3_BUCKET_NAME, S3_TEST_FILE_KEY, DESTINATION_S3_BUCKET_NAME, 1000)
            self.assertEqual(type(file_content), str)
    
    def test_submit_job_error(self):
         with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', 'JOB_DEFINITION': self.job_definition_arn,'JOB_DEFINITION_X_REGION': self.job_definition_arn, 'JOB_QUEUE': self.job_q_arn, 'DESTINATION_BUCKET_NAME': DESTINATION_S3_BUCKET_NAME, 'DISABLE_PENDING_JOBS_CHECK': "true", 'MAX_NUMBER_OF_PENDING_JOBS': "96", 'MN_SIZE_FOR_BATCH_IN_BYTES': "524288000", 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': 'AwsSolution/SO0133/1.1.0'}):
            from mediasync_driver.app import submit_job
            self.assertRaises(Exception, submit_job, '1', S3_TEST_FILE_KEY, S3_BUCKET_NAME, DESTINATION_S3_BUCKET_NAME, 1000)

    def test_in_place_copy_success(self):
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No'}):
            from mediasync_driver.app import in_place_copy
            file_content = in_place_copy(S3_BUCKET_NAME, S3_TEST_FILE_KEY, DESTINATION_S3_BUCKET_NAME)
            self.assertEqual(file_content, 'Success')

    def test_in_place_copy_error(self):
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No'}):
            from mediasync_driver.app import in_place_copy
            self.assertRaises(Exception, in_place_copy, S3_TEST_FILE_KEY, S3_BUCKET_NAME, DESTINATION_S3_BUCKET_NAME)

    def test_is_can_submit_jobs_success(self):
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', 'JOB_DEFINITION': self.job_definition_arn,'JOB_DEFINITION_X_REGION': self.job_definition_arn, 'JOB_QUEUE': self.job_q_arn, 'DESTINATION_BUCKET_NAME': DESTINATION_S3_BUCKET_NAME, 'DISABLE_PENDING_JOBS_CHECK': 'True', 'MAX_NUMBER_OF_PENDING_JOBS': "96", 'MN_SIZE_FOR_BATCH_IN_BYTES': "524288000", 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': 'AwsSolution/SO0133/1.1.0'}):
            from mediasync_driver.app import is_can_submit_jobs
            file_content = is_can_submit_jobs()
            self.assertEqual(file_content, True)

    def test_is_can_submit_jobs_error(self):
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', 'JOB_DEFINITION': self.job_definition_arn,'JOB_DEFINITION_X_REGION': self.job_definition_arn, 'JOB_QUEUE': 'self.job_q_arn', 'DESTINATION_BUCKET_NAME': DESTINATION_S3_BUCKET_NAME, 'DISABLE_PENDING_JOBS_CHECK': 'False', 'MAX_NUMBER_OF_PENDING_JOBS': "-1", 'MN_SIZE_FOR_BATCH_IN_BYTES': "524288000", 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': 'AwsSolution/SO0133/1.1.0'}):
            from mediasync_driver.app import is_can_submit_jobs
            self.assertRaises(Exception, is_can_submit_jobs)

    def test_lambda_handler_success(self):
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', 'JOB_DEFINITION': self.job_definition_arn,'JOB_DEFINITION_X_REGION': self.job_definition_arn, 'JOB_QUEUE': 'self.job_q_arn', 'DESTINATION_BUCKET_NAME': DESTINATION_S3_BUCKET_NAME, 'DISABLE_PENDING_JOBS_CHECK': 'False', 'MAX_NUMBER_OF_PENDING_JOBS': "-1", 'MN_SIZE_FOR_BATCH_IN_BYTES': "524288000", 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': 'AwsSolution/SO0133/1.1.0'}):
            from mediasync_driver.app import lambda_handler
            event = {'invocationId': 'AAAAAAAAAAGWgy8JjVTzbOFpcBAhM9pchaE+qu4XrMu2XLfc37ExmFecq9NilQyVWPcPsAvpGR4utm/aCwIs29KUFoPxOn3oeNlTxvNFDYBJvSUkZZGJW9wrFp3M6/tZ+mNUnAzzqwp6e7Mg7dX/6ed2nWbGGIa44f/oScf+umFqo0B2HlI7dH68FNEK57YMuRZ+sKhznhf0U+FPa4yb7o/5cmPVbgmpHMMMivZBel99ajeXXsdwHXtEFx+ynkD9NwUGKDXouS/mEltGBgAUom1fughvTSlG5hWlCcUz/gMeo1xkW9A3plwlE6xaUu9G4tKsoZESVpB+/ENQjhAJXSYToUTO2BR6kA2RjSCVGY5hiZyzYHzkvFingvqz2atr3Tp6DkiybChqu1WjyWHCLnpj3gfC4m3/HLaSfkz+Mua28aeShpyrv1tcmt70GnOTkPvEh6Zq/kyTW7bvyn64zzLdhQjb2F6ASuA/IQBqPhTtn3mwDG4i/cSoS+t+cF1nosOLyeMRPBpBTRGGqsdvxuZG9t6YNGIyLohh2L4O7GVU/QdbmhXdimOoSqgWHke+ZWV6VXvODfV4GuiW4bbkG6C7lMmR7cMeR2n/9YZBt/UUepBL/NGNJvE4gCyBOPS34PxSFrMcYzIreuxKoQan65APUvsqiJwpGQas96w0ijebjcm4ebRUfLHOo4o7G2GGwxC/e0+tiAwISz/ywOVxV9oMH/ee1ixogEyjAprHehJu2R0kWzSFb9siBhBac8W8KowSZ3lRWvpamL0UZIqfWyFr+UGzruauEzCVchwx3rboeImB0yOSGgTna2Rli7aaMhSNyROQq5GfsjGDDPN4gP7evX6ImgfT2k2i5U5YrAWqNSsA7rM7qZ+ZSYpRlLVQjKvj+RJV0jvfMnHe893bx6yn/GbIHPWXr90ho2qhgyuMlKjfyIVqaD60DsNOQ3/rw40mrI1LhOgjFi3F5OoRTlX69bB9+Y5k0CZS6b8mbb9cHYr56F2u0rDh+VWPe7ALDKMFk3d0E7fH2RPW6E2UcaI5nxhJIWN+JXm1ttCw/o5sRMLNJ3VIN9dx7j0QEuq2zeuW2+b9hohSyb+R5rAkApbpE7CFCsPsGHsO3so8vm6oWcGG9m8m4MRN4G4hDPV6y5yRA8z2r4fHC+yE08v3Ica9KY3BVQfO0ypPlR1LbXlyT4PAYxjhlbKV6rOAlU5vLFH9JIT55mt2DpVb4Pg0CPC7lts38v8KPmVSRqToa9NxblIla4nXgigqHamOvvCkqDV7wUJjHSQLaejq1EawwnStVXgnoCLMMLKZYfj12kPj1/DemOlPwj2jhyWdestI1qo+x6RziGEta5gEyjV3ofRkqrA7KxLlkPH6Pr+yfLr0l493UpVatQu/K1xAvC0hPLHzcgKUSAtfacvlCaBzaQrV1AOOpXcEuAF6d22AR0d96C39ZoFD14CnxiRn053EsE3aIbVurW1O3dq0r7LXb9kq9rlaz25ae7TkhGmaPkGgJXuFC3tfKpIv+8zHtKZ28evmtujkOCD+fIAsNzGC8FsvHQ2/KkeHCSbtfnAwehhezAlfAY9PLcBzJTNeoD+FZGbsAUAq/YXvx7lLiE+tU6mA/RHv/PfhGA9PQIB/kcZBjCks6axMfgbOLdFlrqu8xz3H0sxm9UnaFU1CqyoKxc+PIwJQgxspwcK+fKPt7eemz0QGHDeVjMMRJXXqNFV7TtZ8zQ==', 'job': {'id': '9357a3a7-5e34-4fa9-a1df-e1a4299b90b7'}, 'tasks': [{'taskId': 'AAAAAAAAAAHbcGNRFySaCUSvTLvgWOklp/svCnDejopfRyJeRA5SFbItymOoLQ8/UPW/PPGKfr4zdsBxIYizEtOnNWs8U0pftponXub73AuiVyQwTGp+MgaaMtb/mpj5sp95GzLFzHH1+fLNQNtSZGTdZmLLcNiG04IqmqOBZaqKdk2y84dX40FxwP69A/JSSt6Zq8t/JAdGZ99IN8wnqyFwTTjhBE15PbJVAIejVIpcMKktSKA0p0ukRcmBGZRcctg50e1Aos86/kwD04S0JBpDhxRtu73Hn9XlvqA3h7Zz4S01kYv7fJPsIdD6eEKmQb/tWkqiVz9PDksQAbaapJHB7aM6rPqJAXtYKD3Mm4EokFiF1tTeGTr1nFfAw1IqgNx0BqmCflFOKWFF6bpT2ThsKdJDtNmzmoXtMOpgZ7U94QsZ2XzFg2mHxGNgESoOJwJ3ZflfrhnzQLiHjtRKkBmM89txAgjVOR8LAZ48ZIghzFMxFSPDRKKnOuqcWia6rDBjjdlvpzlReIJW+VGEvCCtx7HB+Zx9DwTHm/0wfW7hm3k1Mc4YpKy4fANWAUnghQJc8EWRnzDXT5g1Oj33KqxU6e5z26cZsawKcWj+QgULoDpyPeX86wtzWyEVU0MaH9XNZ7/GUqcRpDusZ7XrnQ/R6sYuh1Y2ijHSQRl7M54isRmQVvJFyqxe82ivS3lauvLyfqLQ+QE4Fx2SZBXE1hn9Df6Gh2nTnIeqqvqhG7MUOr9Gxth+oMZ8wOOJd/pQ4UBPESIDQ/HAgLpf+nCZxZOLmhD7VsR3H+WKXznQC8UWP4lfOpYkjIMv1x1HB3x4WJRwkb7/zjciTBvtQw87a9n0VCOAj+IGfFEX1fkNi3IbA91zpNUM//SFZj3L4E8aFwpeFLdd3esDlsaG3lRgifiSKtu6OnJGu4LU09ebYs06qEA=', 's3BucketArn': 'arn:aws:s3:::buckettestname', 's3Key': 'BigBunnySample.mp4', 's3VersionId': None}], 'invocationSchemaVersion': '1.0'}
            file_content = lambda_handler(event, '_')
            self.assertEqual(file_content.get('results')[0].get('resultCode'), 'Succeeded')

    def test_lambda_handler_error(self):
        with mock.patch.dict(os.environ, {'SendAnonymizedMetric': 'No', 'JOB_DEFINITION': self.job_definition_arn,'JOB_DEFINITION_X_REGION': self.job_definition_arn, 'JOB_QUEUE': 'self.job_q_arn', 'DESTINATION_BUCKET_NAME': DESTINATION_S3_BUCKET_NAME, 'DISABLE_PENDING_JOBS_CHECK': 'False', 'MAX_NUMBER_OF_PENDING_JOBS': "-1", 'MN_SIZE_FOR_BATCH_IN_BYTES': "524288000", 'LogLevel': 'INFO', 'SOLUTION_IDENTIFIER': 'AwsSolution/SO0133/1.1.0'}):
            from mediasync_driver.app import lambda_handler
            event = {'invocationId': 'AAAAAAAAAAGWgy8JjVTzbOFpcBAhM9pchaE+qu4XrMu2XLfc37ExmFecq9NilQyVWPcPsAvpGR4utm/aCwIs29KUFoPxOn3oeNlTxvNFDYBJvSUkZZGJW9wrFp3M6/tZ+mNUnAzzqwp6e7Mg7dX/6ed2nWbGGIa44f/oScf+umFqo0B2HlI7dH68FNEK57YMuRZ+sKhznhf0U+FPa4yb7o/5cmPVbgmpHMMMivZBel99ajeXXsdwHXtEFx+ynkD9NwUGKDXouS/mEltGBgAUom1fughvTSlG5hWlCcUz/gMeo1xkW9A3plwlE6xaUu9G4tKsoZESVpB+/ENQjhAJXSYToUTO2BR6kA2RjSCVGY5hiZyzYHzkvFingvqz2atr3Tp6DkiybChqu1WjyWHCLnpj3gfC4m3/HLaSfkz+Mua28aeShpyrv1tcmt70GnOTkPvEh6Zq/kyTW7bvyn64zzLdhQjb2F6ASuA/IQBqPhTtn3mwDG4i/cSoS+t+cF1nosOLyeMRPBpBTRGGqsdvxuZG9t6YNGIyLohh2L4O7GVU/QdbmhXdimOoSqgWHke+ZWV6VXvODfV4GuiW4bbkG6C7lMmR7cMeR2n/9YZBt/UUepBL/NGNJvE4gCyBOPS34PxSFrMcYzIreuxKoQan65APUvsqiJwpGQas96w0ijebjcm4ebRUfLHOo4o7G2GGwxC/e0+tiAwISz/ywOVxV9oMH/ee1ixogEyjAprHehJu2R0kWzSFb9siBhBac8W8KowSZ3lRWvpamL0UZIqfWyFr+UGzruauEzCVchwx3rboeImB0yOSGgTna2Rli7aaMhSNyROQq5GfsjGDDPN4gP7evX6ImgfT2k2i5U5YrAWqNSsA7rM7qZ+ZSYpRlLVQjKvj+RJV0jvfMnHe893bx6yn/GbIHPWXr90ho2qhgyuMlKjfyIVqaD60DsNOQ3/rw40mrI1LhOgjFi3F5OoRTlX69bB9+Y5k0CZS6b8mbb9cHYr56F2u0rDh+VWPe7ALDKMFk3d0E7fH2RPW6E2UcaI5nxhJIWN+JXm1ttCw/o5sRMLNJ3VIN9dx7j0QEuq2zeuW2+b9hohSyb+R5rAkApbpE7CFCsPsGHsO3so8vm6oWcGG9m8m4MRN4G4hDPV6y5yRA8z2r4fHC+yE08v3Ica9KY3BVQfO0ypPlR1LbXlyT4PAYxjhlbKV6rOAlU5vLFH9JIT55mt2DpVb4Pg0CPC7lts38v8KPmVSRqToa9NxblIla4nXgigqHamOvvCkqDV7wUJjHSQLaejq1EawwnStVXgnoCLMMLKZYfj12kPj1/DemOlPwj2jhyWdestI1qo+x6RziGEta5gEyjV3ofRkqrA7KxLlkPH6Pr+yfLr0l493UpVatQu/K1xAvC0hPLHzcgKUSAtfacvlCaBzaQrV1AOOpXcEuAF6d22AR0d96C39ZoFD14CnxiRn053EsE3aIbVurW1O3dq0r7LXb9kq9rlaz25ae7TkhGmaPkGgJXuFC3tfKpIv+8zHtKZ28evmtujkOCD+fIAsNzGC8FsvHQ2/KkeHCSbtfnAwehhezAlfAY9PLcBzJTNeoD+FZGbsAUAq/YXvx7lLiE+tU6mA/RHv/PfhGA9PQIB/kcZBjCks6axMfgbOLdFlrqu8xz3H0sxm9UnaFU1CqyoKxc+PIwJQgxspwcK+fKPt7eemz0QGHDeVjMMRJXXqNFV7TtZ8zQ==', 'job': {'id': '9357a3a7-5e34-4fa9-a1df-e1a4299b90b7'}, 'tasks': [{'taskId': 'AAAAAAAAAAHbcGNRFySaCUSvTLvgWOklp/svCnDejopfRyJeRA5SFbItymOoLQ8/UPW/PPGKfr4zdsBxIYizEtOnNWs8U0pftponXub73AuiVyQwTGp+MgaaMtb/mpj5sp95GzLFzHH1+fLNQNtSZGTdZmLLcNiG04IqmqOBZaqKdk2y84dX40FxwP69A/JSSt6Zq8t/JAdGZ99IN8wnqyFwTTjhBE15PbJVAIejVIpcMKktSKA0p0ukRcmBGZRcctg50e1Aos86/kwD04S0JBpDhxRtu73Hn9XlvqA3h7Zz4S01kYv7fJPsIdD6eEKmQb/tWkqiVz9PDksQAbaapJHB7aM6rPqJAXtYKD3Mm4EokFiF1tTeGTr1nFfAw1IqgNx0BqmCflFOKWFF6bpT2ThsKdJDtNmzmoXtMOpgZ7U94QsZ2XzFg2mHxGNgESoOJwJ3ZflfrhnzQLiHjtRKkBmM89txAgjVOR8LAZ48ZIghzFMxFSPDRKKnOuqcWia6rDBjjdlvpzlReIJW+VGEvCCtx7HB+Zx9DwTHm/0wfW7hm3k1Mc4YpKy4fANWAUnghQJc8EWRnzDXT5g1Oj33KqxU6e5z26cZsawKcWj+QgULoDpyPeX86wtzWyEVU0MaH9XNZ7/GUqcRpDusZ7XrnQ/R6sYuh1Y2ijHSQRl7M54isRmQVvJFyqxe82ivS3lauvLyfqLQ+QE4Fx2SZBXE1hn9Df6Gh2nTnIeqqvqhG7MUOr9Gxth+oMZ8wOOJd/pQ4UBPESIDQ/HAgLpf+nCZxZOLmhD7VsR3H+WKXznQC8UWP4lfOpYkjIMv1x1HB3x4WJRwkb7/zjciTBvtQw87a9n0VCOAj+IGfFEX1fkNi3IbA91zpNUM//SFZj3L4E8aFwpeFLdd3esDlsaG3lRgifiSKtu6OnJGu4LU09ebYs06qEA=', 's3BucketArn': 'arn:aws:s3:::buckettestname', 's3Key': 'BigBunnySamp.mp4', 's3VersionId': None}], 'invocationSchemaVersion': '1.0'}
            file_content = lambda_handler(event, '_')
            self.assertEqual(file_content, {'invocationSchemaVersion': '1.0', 'treatMissingKeysAs': 'PermanentFailure', 'invocationId': 'AAAAAAAAAAGWgy8JjVTzbOFpcBAhM9pchaE+qu4XrMu2XLfc37ExmFecq9NilQyVWPcPsAvpGR4utm/aCwIs29KUFoPxOn3oeNlTxvNFDYBJvSUkZZGJW9wrFp3M6/tZ+mNUnAzzqwp6e7Mg7dX/6ed2nWbGGIa44f/oScf+umFqo0B2HlI7dH68FNEK57YMuRZ+sKhznhf0U+FPa4yb7o/5cmPVbgmpHMMMivZBel99ajeXXsdwHXtEFx+ynkD9NwUGKDXouS/mEltGBgAUom1fughvTSlG5hWlCcUz/gMeo1xkW9A3plwlE6xaUu9G4tKsoZESVpB+/ENQjhAJXSYToUTO2BR6kA2RjSCVGY5hiZyzYHzkvFingvqz2atr3Tp6DkiybChqu1WjyWHCLnpj3gfC4m3/HLaSfkz+Mua28aeShpyrv1tcmt70GnOTkPvEh6Zq/kyTW7bvyn64zzLdhQjb2F6ASuA/IQBqPhTtn3mwDG4i/cSoS+t+cF1nosOLyeMRPBpBTRGGqsdvxuZG9t6YNGIyLohh2L4O7GVU/QdbmhXdimOoSqgWHke+ZWV6VXvODfV4GuiW4bbkG6C7lMmR7cMeR2n/9YZBt/UUepBL/NGNJvE4gCyBOPS34PxSFrMcYzIreuxKoQan65APUvsqiJwpGQas96w0ijebjcm4ebRUfLHOo4o7G2GGwxC/e0+tiAwISz/ywOVxV9oMH/ee1ixogEyjAprHehJu2R0kWzSFb9siBhBac8W8KowSZ3lRWvpamL0UZIqfWyFr+UGzruauEzCVchwx3rboeImB0yOSGgTna2Rli7aaMhSNyROQq5GfsjGDDPN4gP7evX6ImgfT2k2i5U5YrAWqNSsA7rM7qZ+ZSYpRlLVQjKvj+RJV0jvfMnHe893bx6yn/GbIHPWXr90ho2qhgyuMlKjfyIVqaD60DsNOQ3/rw40mrI1LhOgjFi3F5OoRTlX69bB9+Y5k0CZS6b8mbb9cHYr56F2u0rDh+VWPe7ALDKMFk3d0E7fH2RPW6E2UcaI5nxhJIWN+JXm1ttCw/o5sRMLNJ3VIN9dx7j0QEuq2zeuW2+b9hohSyb+R5rAkApbpE7CFCsPsGHsO3so8vm6oWcGG9m8m4MRN4G4hDPV6y5yRA8z2r4fHC+yE08v3Ica9KY3BVQfO0ypPlR1LbXlyT4PAYxjhlbKV6rOAlU5vLFH9JIT55mt2DpVb4Pg0CPC7lts38v8KPmVSRqToa9NxblIla4nXgigqHamOvvCkqDV7wUJjHSQLaejq1EawwnStVXgnoCLMMLKZYfj12kPj1/DemOlPwj2jhyWdestI1qo+x6RziGEta5gEyjV3ofRkqrA7KxLlkPH6Pr+yfLr0l493UpVatQu/K1xAvC0hPLHzcgKUSAtfacvlCaBzaQrV1AOOpXcEuAF6d22AR0d96C39ZoFD14CnxiRn053EsE3aIbVurW1O3dq0r7LXb9kq9rlaz25ae7TkhGmaPkGgJXuFC3tfKpIv+8zHtKZ28evmtujkOCD+fIAsNzGC8FsvHQ2/KkeHCSbtfnAwehhezAlfAY9PLcBzJTNeoD+FZGbsAUAq/YXvx7lLiE+tU6mA/RHv/PfhGA9PQIB/kcZBjCks6axMfgbOLdFlrqu8xz3H0sxm9UnaFU1CqyoKxc+PIwJQgxspwcK+fKPt7eemz0QGHDeVjMMRJXXqNFV7TtZ8zQ==', 'results': [{'taskId': 'AAAAAAAAAAHbcGNRFySaCUSvTLvgWOklp/svCnDejopfRyJeRA5SFbItymOoLQ8/UPW/PPGKfr4zdsBxIYizEtOnNWs8U0pftponXub73AuiVyQwTGp+MgaaMtb/mpj5sp95GzLFzHH1+fLNQNtSZGTdZmLLcNiG04IqmqOBZaqKdk2y84dX40FxwP69A/JSSt6Zq8t/JAdGZ99IN8wnqyFwTTjhBE15PbJVAIejVIpcMKktSKA0p0ukRcmBGZRcctg50e1Aos86/kwD04S0JBpDhxRtu73Hn9XlvqA3h7Zz4S01kYv7fJPsIdD6eEKmQb/tWkqiVz9PDksQAbaapJHB7aM6rPqJAXtYKD3Mm4EokFiF1tTeGTr1nFfAw1IqgNx0BqmCflFOKWFF6bpT2ThsKdJDtNmzmoXtMOpgZ7U94QsZ2XzFg2mHxGNgESoOJwJ3ZflfrhnzQLiHjtRKkBmM89txAgjVOR8LAZ48ZIghzFMxFSPDRKKnOuqcWia6rDBjjdlvpzlReIJW+VGEvCCtx7HB+Zx9DwTHm/0wfW7hm3k1Mc4YpKy4fANWAUnghQJc8EWRnzDXT5g1Oj33KqxU6e5z26cZsawKcWj+QgULoDpyPeX86wtzWyEVU0MaH9XNZ7/GUqcRpDusZ7XrnQ/R6sYuh1Y2ijHSQRl7M54isRmQVvJFyqxe82ivS3lauvLyfqLQ+QE4Fx2SZBXE1hn9Df6Gh2nTnIeqqvqhG7MUOr9Gxth+oMZ8wOOJd/pQ4UBPESIDQ/HAgLpf+nCZxZOLmhD7VsR3H+WKXznQC8UWP4lfOpYkjIMv1x1HB3x4WJRwkb7/zjciTBvtQw87a9n0VCOAj+IGfFEX1fkNi3IbA91zpNUM//SFZj3L4E8aFwpeFLdd3esDlsaG3lRgifiSKtu6OnJGu4LU09ebYs06qEA=', 'resultCode': 'PermanentFailure', 'resultString': '404: Not Found'}]})


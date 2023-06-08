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
from moto import mock_s3
from botocore.exceptions import ClientError

S3_BUCKET_NAME = 'exchangebucket'
DESTINATION_S3_BUCKET_NAME = 'actualtestbucketname'
DEFAULT_REGION = 'us-east-1'
S3_TEST_FILE_KEY = 'test_app3.json'
S3_TEST_FILE_CONTENT = [
    {"company": "amazon", "price": 15},
    {"company": "test", "price": 25}
]

@mock_s3
@mock.patch.dict(os.environ, {'SOURCE_BUCKET_NAME': S3_BUCKET_NAME,'SOLUTION_IDENTIFIER': 'SO0133', 'LogLevel': 'INFO', 'DESTINATION_BUCKET_NAME': DESTINATION_S3_BUCKET_NAME, 'DESTINATION_PREFIX': 'ingest'})
class TestAutoIngestLambdaFunction(unittest.TestCase):
    def setUp(self):
        # S3 setup
        self.s3 = boto3.resource('s3', region_name=DEFAULT_REGION) 
        self.s3_bucket = self.s3.create_bucket(Bucket=S3_BUCKET_NAME) # Fake Media Exchange Bucket
        self.s3.BucketVersioning(S3_BUCKET_NAME).enable()
        self.destination_s3_bucket = self.s3.create_bucket(Bucket=DESTINATION_S3_BUCKET_NAME) # Fake ingest bucket
        self.s3_bucket.put_object(Key=S3_TEST_FILE_KEY,
                                  Body=json.dumps(S3_TEST_FILE_CONTENT)) # Emulate file in ME bucket
        self.S3_TEST_FILE_VERSION = self.s3.Bucket(S3_BUCKET_NAME).Object(S3_TEST_FILE_KEY).version_id # Save file version

    def test_match_bucket_name_success(self):
        from autoingest_driver.app import match_bucket_name
        file_content = match_bucket_name(S3_BUCKET_NAME)
        self.assertEqual(file_content, 'Success')
    
    def test_match_bucket_name_error(self):
        from autoingest_driver.app import match_bucket_name
        file_content = match_bucket_name(DEFAULT_REGION)
        self.assertEqual(file_content, None)

    def test_check_object_success(self):
        from autoingest_driver.app import check_object
        file_content = check_object(S3_BUCKET_NAME, S3_TEST_FILE_KEY)
        self.assertEqual(file_content, 'Success')
    
    def test_check_object_error(self):
        from autoingest_driver.app import check_object
        self.assertRaises(ClientError, check_object, S3_BUCKET_NAME, DEFAULT_REGION)

    def test_copy_object_success(self):
        from autoingest_driver.app import copy_object
        file_content = copy_object(S3_BUCKET_NAME, S3_TEST_FILE_KEY, self.S3_TEST_FILE_VERSION, DESTINATION_S3_BUCKET_NAME, 'ingest')
        self.assertEqual(file_content, 'Success')

    def test_copy_object_error(self):
        from autoingest_driver.app import copy_object
        self.assertRaises(Exception, copy_object, S3_TEST_FILE_KEY, S3_BUCKET_NAME, self.S3_TEST_FILE_VERSION, DESTINATION_S3_BUCKET_NAME, 'ingest')

    def test_handler_success(self):
        from autoingest_driver.app import lambda_handler
        event = {
            "Records": [
                {
                    "messageId": "aa3b554c-f909-4453-a846-da9f90f11c24",
                    "receiptHandle": "AQEBH1Dm1PA4UtuL0uPas5m0rJdmPSPv3ulb7Q+vda4ZCJNvgdo5vDARZUByMxASaWX+MWQU9sEIxqgQXCc2wz7splIQ542h7dZF3FDlWTlMbaVB4a8litsFVy28PrBuWBxwJYLdIkEul+lvVDdl1ht4h4YHQlb61oG5AhTB0+6AByoQWf2RKB/tIRO+iTAc2Pm0Fk/aC/LE6r2LkeTVFTOK6NymWB+beEFdhsSCEyAsiODy7tOceQlzurwroqUeU+WYLoCwQLypiaokZ1OiXNTRyhrlEiJem4cRV28f2i7F68A4b6okRo8xubsRjpDTx4Y8hlpj5wJS7TDihTIBalVOHiP6LvhfFS850xus6AoVB0b8kMbZxxbbEjFCqtPLa7D90vEVbPQBFcEo+Rb7lg2aVziAABhsxJK53IVeIel8OrnBtzEo4Dzfk/S7LhJWndVH",
                    "body": "{\n  \"Type\" : \"Notification\",\n  \"MessageId\" : \"fe39e72c-90d8-567b-bae3-bbc575fdbb02\",\n  \"TopicArn\" : \"test-string\",\n  \"Message\" : \"{\\\"version\\\":\\\"0\\\",\\\"bucket\\\":{\\\"name\\\":\\\"exchangebucket\\\"},\\\"object\\\":{\\\"key\\\":\\\"test_app3.json\\\",\\\"size\\\":3248,\\\"etag\\\":\\\"cdce56146d5c79a7bb8e35b89d73a304\\\",\\\"version-id\\\":\\\"%s\\\",\\\"sequencer\\\":\\\"00646FE2E3E5AA55B7\\\"},\\\"request-id\\\":\\\"WH6BBZSWBQJ64B8C\\\",\\\"requester\\\":\\\"test-requester\\\",\\\"source-ip-address\\\":\\\"test\\\",\\\"reason\\\":\\\"PutObject\\\"}\",\n  \"Timestamp\" : \"2023-05-25T22:36:21.738Z\",\n  \"SignatureVersion\" : \"1\"\n}" % self.S3_TEST_FILE_VERSION,
                    "attributes": {
                        "ApproximateReceiveCount": "1",
                        "SentTimestamp": "1685054181791",
                        "SenderId": "AIDAIT2UOQQY3AUEKVGXU",
                        "ApproximateFirstReceiveTimestamp": "1685054181801"
                    },
                    "messageAttributes": {},
                    "md5OfBody": "056d8e151714a82293532cd8a15c5e77",
                    "eventSource": "aws:sqs",
                    "awsRegion": "us-east-1"
                }
            ]
        }
        result = lambda_handler(event, {})
        self.assertEqual(result, {'ResultCode': '0', 'ResultString': 'Successfully copied'})


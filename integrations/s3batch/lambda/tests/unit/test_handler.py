# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import json
import pytest
import os
from moto import mock_s3, mock_lambda

@pytest.fixture()
def s3_batch_event():

    return {
        "invocationSchemaVersion": "1.0",
            "invocationId": "YXNkbGZqYWRmaiBhc2RmdW9hZHNmZGpmaGFzbGtkaGZza2RmaAo",
            "job": {
                "id": "f3cc4f60-61f6-4a2b-8a21-d07600c373ce"
            },
            "tasks": [
                {
                    "taskId": "dGFza2lkZ29lc2hlcmUK",
                    "s3Key": "HappyFace.jpg",
                    "s3VersionId": "1",
                    "s3BucketArn": "arn:aws:s3:us-east-1:0123456788:awsexamplebucket"
                }
            ]
        }


@mock_lambda
def test_lambda_handler(s3_batch_event, mocker):

    os.environ["AWS_ACCESS_KEY_ID"] = "test"
    os.environ["AWS_SECRET_ACCESS_KEY"] = "test"

    from driver import app

    ret = app.lambda_handler(s3_batch_event, "")

    assert ret["invocationSchemaVersion"] == "1.0"
    assert ret["treatMissingKeysAs"] == "PermanentFailure"
    assert ret["invocationId"] == "YXNkbGZqYWRmaiBhc2RmdW9hZHNmZGpmaGFzbGtkaGZza2RmaAo"

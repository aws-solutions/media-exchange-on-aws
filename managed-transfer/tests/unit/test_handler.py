import json

import pytest

from driver import app


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



def test_lambda_handler(s3_batch_event, mocker):

    ret = app.lambda_handler(s3_batch_event, "")

    assert ret["invocationSchemaVersion"] == "1.0"
    assert ret["treatMissingKeysAs"] == "PermanentFailure"
    assert ret["invocationId"] == "YXNkbGZqYWRmaiBhc2RmdW9hZHNmZGpmaGFzbGtkaGZza2RmaAo"

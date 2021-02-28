# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import os
import logging
import boto3
import json
import urllib
import jsonpickle
from botocore.exceptions import ClientError
import unicodedata

from aws_xray_sdk.core import xray_recorder
from aws_xray_sdk.core import patch_all

logger = logging.getLogger()
logger.setLevel(logging.INFO)

lambdaclient = boto3.client('lambda')
lambdaclient.get_account_settings()
patch_all()

batchclient = boto3.client('batch')
s3client = boto3.client('s3')




def lambda_handler(event, context):

    logger.debug('## EVENT\r' + jsonpickle.encode(dict(**event)))

    jobId = event['job']['id']
    invocationId = event['invocationId']
    invocationSchemaVersion = event['invocationSchemaVersion']

    taskId = event['tasks'][0]['taskId']
    sourceKey = urllib.parse.unquote_plus(event['tasks'][0]['s3Key'])
    s3BucketArn = event['tasks'][0]['s3BucketArn']
    sourceBucket = s3BucketArn.split(':::')[-1]

    results = []
    # Prepare result code and string
    resultCode = None
    resultString = None

    try:
        logger.debug("preflight check start")

        #preflight checks _read_
        pre_flight_response = s3client.head_object(
            Bucket=sourceBucket,
            Key=sourceKey
        )

        logger.debug('## PREFLIGHT_RESPONSE\r' + jsonpickle.encode(dict(**pre_flight_response)))

        if 'DeleteMarker' in pre_flight_response:
            if  pre_flight_response['pre_flight_response'] == True:
                raise Exception('Object ' + sourceKey + ' is deleted')

        size = pre_flight_response['ContentLength']
        logger.debug("preflight check end")

        unsupportedStorageClass = False

        #Storage class check
        if 'StorageClass' in pre_flight_response:
            if pre_flight_response['StorageClass'] in ['GLACIER', 'DEEP_ARCHIVE']:
                #check restore status:
                if 'Restore' in pre_flight_response:
                    restore = pre_flight_response['Restore']
                    logger.debug(restore)
                    if 'ongoing-request="false"' not in restore:
                        logger.info('restore is in progress')
                        raise Exception('Object ' + sourceKey + ' is restoring from '  + pre_flight_response['StorageClass'])
                else:
                    unsupportedStorageClass = True

        if (unsupportedStorageClass):
            raise Exception('Object ' + sourceKey + ' is in unsupported StorageClass '  + pre_flight_response['StorageClass'])

        #NFC for unicodedata
        if unicodedata.is_normalized('NFC', sourceKey) == False:
            raise Exception('Object ' + sourceKey + ' is not in Normalized Form C' )

        logger.debug("job submission start")
        jobDefinition = os.environ['JobSizeS'] if pre_flight_response['ContentLength'] < 10737418240 else os.environ['JobSizeL']
        logger.debug("job definition is " + jobDefinition)

        jobQ = os.environ['JobQueueS'] if pre_flight_response['ContentLength'] < 10737418240 else os.environ['JobQueueL']
        logger.debug("job Q is " + jobQ)

        #submit job
        response = batchclient.submit_job(
            jobName="FixityJob",
            jobQueue=jobQ,
            # use bigger containers for 5GB+
            jobDefinition=jobDefinition,
            parameters={
                'SourceS3Uri': 's3://' + sourceBucket + '/' + sourceKey
            }
        )

        logger.debug('## BATCH_RESPONSE\r' + jsonpickle.encode(dict(**pre_flight_response)))
        logger.debug("job submission complete")
        resultCode = 'Succeeded'

        detail = 'https://console.aws.amazon.com/batch/v2/home?region=' + os.environ['AWS_REGION'] + '#jobs/detail/'+ response['jobId']
        resultString = detail

    except ClientError as e:
        # If request timed out, mark as a temp failure
        # and S3 Batch Operations will make the task for retry. If
        # any other exceptions are received, mark as permanent failure.
        errorCode = e.response['Error']['Code']
        errorMessage = e.response['Error']['Message']

        logger.debug(errorMessage)

        if errorCode == 'TooManyRequestsException':
            resultCode = 'TemporaryFailure'
            resultString = 'Retry request to batch due to throttling.'
        elif errorCode == 'RequestTimeout':
            resultCode = 'TemporaryFailure'
            resultString = 'Retry request to Amazon S3 due to timeout.'
        elif (errorCode == '304'):
            resultCode = 'Succeeded'
            resultString = 'Not modified'
        elif (errorCode == 'SlowDown'):
            resultCode = 'TemporaryFailure'
            resultString = 'Retry request to s3 due to throttling.'
        else:
            resultCode = 'PermanentFailure'
            resultString = '{}: {}'.format(errorCode, errorMessage)

    except Exception as e:
        # Catch all exceptions to permanently fail the task
        resultCode = 'PermanentFailure'
        resultString = 'Exception: {}'.format(e)

    finally:
        results.append({
            'taskId': taskId,
            'resultCode': resultCode,
            'resultString': resultString
        })
        logger.info(resultCode + " # " + resultString)

    return {
        'invocationSchemaVersion': invocationSchemaVersion,
        'treatMissingKeysAs': 'PermanentFailure',
        'invocationId': invocationId,
        'results': results
    }

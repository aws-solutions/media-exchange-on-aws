# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import os
import logging
import boto3
import json
import urllib
import jsonpickle
from botocore.exceptions import ClientError

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

    minsizeforbatch = int(os.environ['MinSizeForBatchinBytes'])

    # Copy object to new bucket with new key name
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
        destinationBucket=os.environ['DestinationBucketName']

        logger.debug("preflight check end")

        if (size > minsizeforbatch):

            unsupportedStorageClass = False

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

            #preflight checks _write_
            s3client.put_object(
                Bucket=destinationBucket,
                Key='scratch/job-'+event['job']['id']
            )

            logger.debug("job submission start")

            #submit job
            response = batchclient.submit_job(
                jobName="CopyStartedByS3Batch",
                jobQueue=os.environ['JobQueue'],
                jobDefinition=os.environ['JobDefinition'],
                parameters={
                    'SourceS3Uri': 's3://' + sourceBucket + '/' + sourceKey,
                    'DestinationS3Uri': 's3://' + destinationBucket + '/' + sourceKey,
                    'Size': str(size)
                }
            )

            logger.debug('## BATCH_RESPONSE\r' + jsonpickle.encode(dict(**pre_flight_response)))
            logger.debug("job submission complete")
            resultString = 'Invoked batch Copy Job'
            # Mark as succeeded
        else:
            s3client.copy({'Bucket': sourceBucket,'Key': sourceKey}, destinationBucket, sourceKey)
            resultString = 'Lambda copy complete'

        resultCode = 'Succeeded'


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
        else:
            if errorCode == 'RequestTimeout':
                resultCode = 'TemporaryFailure'
                resultString = 'Retry request to Amazon S3 due to timeout.'
            else:
                if (errorCode == '304'):
                    resultCode = 'Succeeded'
                    resultString = 'Not modified'
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

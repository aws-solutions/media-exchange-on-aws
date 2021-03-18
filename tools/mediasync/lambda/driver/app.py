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

logger = logging.getLogger()
logger.setLevel(os.environ['LogLevel'])

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

    minsizeforbatch = int(os.environ['MN_SIZE_FOR_BATCH_IN_BYTES'])

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
        destinationBucket=os.environ['DESTINATION_BUCKET_NAME']

        logger.debug("preflight check end")

        if (size > minsizeforbatch):

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


            if (is_can_submit_jobs() == False):

                logger.info("too many jobs pending. returning slowdown")
                resultCode = 'TemporaryFailure'
                resultString = 'Retry request to batch due to too many pending jobs.'

            else:

                logger.debug("job submission start")

                #submit job
                response = batchclient.submit_job(
                    jobName="MediaSyncJob",
                    jobQueue=os.environ['JOB_QUEUE'],
                    jobDefinition=os.environ['JOB_DEFINITION'],
                    parameters={
                        'SourceS3Uri': 's3://' + sourceBucket + '/' + sourceKey,
                        'DestinationS3Uri': 's3://' + destinationBucket + '/' + sourceKey,
                        'Size': str(size)
                    },
                    tags={
                        'S3BatchJobId': jobId,
                        'SourceBucket': sourceBucket,
                        'DestinationBucket': destinationBucket,
                        'Key': sourceKey,
                        'Size': str(size)
                    }
                )

                logger.debug('## BATCH_RESPONSE\r' + jsonpickle.encode(dict(**pre_flight_response)))
                logger.debug("job submission complete")
                resultCode = 'Succeeded'

                detail = 'https://console.aws.amazon.com/batch/v2/home?region=' + os.environ['AWS_REGION'] + '#jobs/detail/'+ response['jobId']
                resultString = detail
                resultCode = 'Succeeded'

        else:
            # <5GB
            copy_response= {}

            if (os.environ['IS_READ_ONLY'] == 'TRUE'):
                copy_response = s3client.copy_object(
                    Bucket=destinationBucket,
                    CopySource={'Bucket': sourceBucket,'Key': sourceKey},
                    GrantRead='id="'+ os.environ['CANNONICAL_USER_ID'] + '"',
                    Key=sourceKey
                )
            else:
                copy_response = s3client.copy_object(
                    Bucket=destinationBucket,
                    CopySource={'Bucket': sourceBucket,'Key': sourceKey},
                    ACL='bucket-owner-full-control',
                    Key=sourceKey
                )

            logger.debug('## COPY_RESPONSE\r' + jsonpickle.encode(dict(**copy_response)))
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


def is_can_submit_jobs():

    # we don't have a good way of checking how many pending jobs as yet
    # without having to build an API

    disable_pending_jobs_test = os.environ['DISABLE_PENDING_JOBS_CHECK']

    if (disable_pending_jobs_test == False):

        ##check how many jobs are pending
        listjobs = batchclient.list_jobs(
            jobQueue=os.environ['JOB_QUEUE'],
            jobStatus='RUNNABLE',
            maxResults=int(os.environ['MAX_NUMBER_OF_PENDING_JOBS'])
        )

        if ('nextToken' in listjobs):
            return False
    else:
        logger.debug("Pending jobs check is disabled")

    return True

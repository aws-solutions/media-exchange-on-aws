# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import os
import logging
import boto3
# import json
import jsonpickle
from botocore.exceptions import ClientError
# import unicodedata
from time import sleep
import urllib
from random import randint

logger = logging.getLogger()
logger.setLevel(os.environ['LogLevel'])

s3client = boto3.client('s3')

def lambda_handler(event, context):

    logger.debug('## EVENT\r' + jsonpickle.encode(dict(**event)))

    records = event['Records']
    for record in records:
        message = jsonpickle.decode(jsonpickle.decode(record['body'])['Message'])

        logger.info('## MESSAGE\r' + jsonpickle.encode(dict(**message)))

        sourceBucket = message['Records'][0]['s3']['bucket']['name']
        sourceKey = urllib.parse.unquote_plus(message['Records'][0]['s3']['object']['key'])
        sourceVersion = message['Records'][0]['s3']['object']['versionId']

        resultCode = '0'
        resultString = 'Successfully copied'

        try:

            if (sourceBucket != os.environ['SOURCE_BUCKET_NAME']):
                raise ClientError({
                    'Error': {
                        'Code': '400',
                        'Message': 'Unsupported source bucket: {}'.format(sourceBucket)
                    },
                    'ResponseMetadata': {}
                })

            pre_flight_response = s3client.head_object(
                Bucket=sourceBucket,
                Key=sourceKey
            )

            logger.debug('## PREFLIGHT_RESPONSE\r' + jsonpickle.encode(dict(**pre_flight_response)))

            if 'DeleteMarker' in pre_flight_response:
                if  pre_flight_response['pre_flight_response'] == True:
                    raise Exception('Object ' + sourceKey + ' is deleted')

            destinationBucket=os.environ['DESTINATION_BUCKET_NAME']

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


            size = pre_flight_response['ContentLength']
            #1 TB
            if (size > 1099511627776):
                logger.warn("the object size is " + size + ". The lambda function may timeout.")

            s3client.copy(CopySource={'Bucket': sourceBucket,'Key': sourceKey, 'VersionId': sourceVersion}, Bucket=destinationBucket, Key='{}/{}'.format(os.environ['DESTINATION_PREFIX'],sourceKey))

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
            elif (errorCode == '400'):
                resultCode = 'Succeeded'
                resultString = errorMessage
            elif (errorCode == 'SlowDown'):
                resultCode = 'TemporaryFailure'
                resultString = 'Retry request to s3 due to throttling.'
            else:
                resultCode = 'PermanentFailure'
                resultString = '{}: {}'.format(errorCode, errorMessage)

            if (resultCode == 'TemporaryFailure'):
                #cooloff anytime between 1-10s. SQS does not support exponential backoff based retry
                logger.info("cooloff..")
                sleep(randint(1,10))
                #retry
                raise

        except Exception as e:
            # Catch all exceptions to permanently fail the task
            resultCode = 'PermanentFailure'
            resultString = 'Exception: {}'.format(e)
            #absorb the error

        finally:
            logger.info(resultCode + " # " + resultString + " # " + sourceKey)

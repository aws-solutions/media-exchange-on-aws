# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import os
import logging
import boto3
import jsonpickle
import urllib
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(os.environ['LogLevel'])

s3client = boto3.client('s3')
eventsClient = boto3.client('events')

def lambda_handler(event, context):

    logger.debug('## EVENT\r' + jsonpickle.encode(dict(**event)))

    records = event['Records']
    for record in records:
        message = jsonpickle.decode(jsonpickle.decode(record['body'])['Message'])

        logger.info('## MESSAGE\r' + jsonpickle.encode(dict(**message)))

        sourceBucket = message['Records'][0]['s3']['bucket']['name']
        sourceKey = urllib.parse.unquote_plus(message['Records'][0]['s3']['object']['key'])
        versionId = message['Records'][0]['s3']['object']['versionId']

        resultCode = '0'
        resultString = 'Successfully added grantee'

        try:

            if (sourceBucket != os.environ['MEDIAEXCHANGE_BUCKET_NAME']):
                raise ClientError({
                    'Error': {
                        'Code': '400',
                        'Message': 'Unsupported source bucket: {}. Please check the SNS topic'.format(sourceBucket)
                    },
                    'ResponseMetadata': {}
                })

            response = s3client.put_object_acl(
                GrantRead='id='+os.environ['CANNONICAL_USER_ID'],
                Bucket=sourceBucket,
                Key=sourceKey,
                VersionId=versionId
            )

            logger.debug('## PUT_OBJECT_ACL_RESPONSE\r' + jsonpickle.encode(dict(**response)))

            #forward the message to the subscriber.
            newMessage = message
            currentVersion = response['ResponseMetadata']['HTTPHeaders']['x-amz-version-id']
            newMessage['Records'][0]['s3']['object']['versionId'] = currentVersion
            # it's always same.

            newMessage['Records'][0]['eventSource'] = 'mxc.pubisher'

            logger.info('## NEW MESSAGE\r' + jsonpickle.encode(dict(**newMessage)))

            response = eventsClient.put_events(
                Entries=[
                    {
                        'Source': 'mxc.publisher',
                        'DetailType': 'bucket={}'.format(sourceBucket),
                        'Detail': jsonpickle.encode(newMessage, unpicklable=False),
                        'EventBusName': os.environ['EVENT_BUS_ARN']
                    }
                ]
            )

            logger.debug('## PUT_EVENTS_RESPONSE\r' + jsonpickle.encode(dict(**response)))

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
                raise

        except Exception as e:
            # Catch all exceptions to permanently fail the task
            resultCode = 'PermanentFailure'
            resultString = 'Exception: {}'.format(e)
            #absorb the error

        finally:
            logger.info(resultCode + " # " + resultString + " # " + sourceKey)

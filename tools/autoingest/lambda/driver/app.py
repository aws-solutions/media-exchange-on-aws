# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import os
import logging
import boto3
import jsonpickle
from botocore.exceptions import ClientError
from time import sleep
import urllib
from random import randint
from botocore import config

logger = logging.getLogger()
logger.setLevel(os.environ['LogLevel'])

solution_identifier= os.environ['SOLUTION_IDENTIFIER']
user_agent_extra_param = {"user_agent_extra":solution_identifier}
config = config.Config(**user_agent_extra_param)

s3client = boto3.client('s3', config=config)


def match_bucket_name(source_bucket):
    if (source_bucket != os.environ['SOURCE_BUCKET_NAME']):
        raise ClientError({
            'Error': {
                'Code': '400',
                'Message': 'Unsupported source bucket: {}'.format(source_bucket)
            },
            'ResponseMetadata': {}
        })

def check_object(source_bucket,source_key):

    pre_flight_response = s3client.head_object(
        Bucket=source_bucket,
        Key=source_key
    )
    logger.debug('## PREFLIGHT_RESPONSE\r' + jsonpickle.encode(dict(**pre_flight_response)))

    size = pre_flight_response['ContentLength']
    #1 TB
    if (size > 1099511627776):
        logger.warn("the object size is " + size + ". The lambda function may timeout.")

def copy_object(source_bucket, source_key,source_version, destination_bucket, prefix):

    s3client.copy(CopySource={'Bucket': source_bucket,'Key': source_key, 'VersionId': source_version}, Bucket=destination_bucket, Key='{}/{}'.format(prefix,source_key))


def lambda_handler(event, _):

    logger.debug('## EVENT\r' + jsonpickle.encode(dict(**event)))

    # there is never more than one record in the payload!
    try:
        records = event['Records']
        if not records:
            raise ClientError({
                'Error': {
                    'Code': '400',
                    'Message': 'no records found in EVENT\r' + jsonpickle.encode(dict(**event))
                },
                'ResponseMetadata': {}
            })

        record = records[0]

        message = jsonpickle.decode(jsonpickle.decode(record['body'])['Message']) #nosec

        logger.info('## MESSAGE\r' + jsonpickle.encode(dict(**message)))

        source_bucket = message['bucket']['name']
        source_key = urllib.parse.unquote_plus(message['object']['key'])
        source_version = message['object']['version-id']

        result_code = '0'
        result_string = 'Successfully copied'


        match_bucket_name(source_bucket)

        if (message['reason'] == 'PutObject'):
            check_object(source_bucket, source_key)
            copy_object(source_bucket, source_key, source_version, os.environ['DESTINATION_BUCKET_NAME'], os.environ['DESTINATION_PREFIX'])
        else:
            result_code = '-1'
            result_string = 'did not process ' + message['reason'] + ' event'

    except ClientError as e:
        # If request timed out, mark as a temp failure
        # and S3 Batch Operations will make the task for retry. If
        # any other exceptions are received, mark as permanent failure.
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']

        logger.debug(error_message)

        if error_code == 'TooManyRequestsException':
            result_code = 'TemporaryFailure'
            result_string = 'Retry request to batch due to throttling.'
        elif error_code == 'RequestTimeout':
            result_code = 'TemporaryFailure'
            result_string = 'Retry request to Amazon S3 due to timeout.'
        elif (error_code == '304'):
            result_code = 'Succeeded'
            result_string = 'Not modified'
        elif (error_code == '400'):
            result_code = 'Succeeded'
            result_string = error_message
        elif (error_code == 'SlowDown'):
            result_code = 'TemporaryFailure'
            result_string = 'Retry request to s3 due to throttling.'
        else:
            result_code = 'PermanentFailure'
            result_string = '{}: {}'.format(error_code, error_message)

        if (result_code == 'TemporaryFailure'):
            #cooloff anytime between 1-10s. SQS does not support exponential backoff based retry
            logger.info("cooloff..")
            sleep(randint(1,10)) #OK
            #retry
            raise

    except Exception as e:
        # Catch all exceptions to permanently fail the task
        result_code = 'PermanentFailure'
        result_string = 'Exception: {}'.format(e)
        #absorb the error

    finally:
        logger.info(result_code + " # " + result_string + " # " + source_key)

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
from botocore import config

solution_identifier= os.environ['SOLUTION_IDENTIFIER']
user_agent_extra_param = {"user_agent_extra":solution_identifier}
config = config.Config(**user_agent_extra_param)

logger = logging.getLogger()
logger.setLevel(os.environ['LogLevel'])

batchclient = boto3.client('batch', config=config)
s3client = boto3.client('s3', config=config)

class ObjectDeletedError(Exception):
    pass

class UnsupportedStorageClassError(Exception):
    pass

class UnsupportedTextFormatError(Exception):
    pass

def api_handler(event, _):

    body = ''
    status = 400
    source_bucket = ''
    source_key = ''

    try:
        logger.debug('## EVENT\r' + jsonpickle.encode(dict(**event)))

        if event['queryStringParameters'] and 'bucket' in event['queryStringParameters'] and 'key' in event['queryStringParameters']:

            source_bucket = event['queryStringParameters']['bucket']
            source_key=  event['queryStringParameters']['key']

            batch_job_id = _submit_job(source_bucket, source_key)
            body = {"JobId" : batch_job_id }

        else:
            status = 400
            body = {"Error": {"Code": 400, "Message": ' \'bucket\' and \'key\' are required query parameters'}}


    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']

        logger.debug(error_message)
        body = {"Error": {"Code": error_code, "Message": error_message}}
        status = 500

    except Exception as e:
        logger.error(e)

        body =  {"Error": {"Code": 500, "Message": "internal server error"} }
        status = 500

    return {
        "statusCode": status,
        "body": json.dumps(body)
    }


def s3_batch_handler(event, _):

    logger.debug('## EVENT\r' + jsonpickle.encode(dict(**event)))

    invocation_id = event['invocationId']
    invocation_schema_version = event['invocationSchemaVersion']

    task_id = event['tasks'][0]['taskId']
    source_key = urllib.parse.unquote_plus(event['tasks'][0]['s3Key'])
    s3_bucket_arn = event['tasks'][0]['s3BucketArn']
    source_bucket = s3_bucket_arn.split(':::')[-1]

    results = []
    # Prepare result code and string
    result_code = None
    result_string = None

    try:
        batch_job_id = _submit_job(source_bucket, source_key)
        result_code = 'Succeeded'
        result_string =  'https://console.aws.amazon.com/batch/v2/home?region=' + os.environ['AWS_REGION'] + '#jobs/detail/'+ batch_job_id

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
        elif (error_code == 'SlowDown'):
            result_code = 'TemporaryFailure'
            result_string = 'Retry request to s3 due to throttling.'
        else:
            result_code = 'PermanentFailure'
            result_string = '{}: {}'.format(error_code, error_message)

    except Exception as e:
        # Catch all exceptions to permanently fail the task
        result_code = 'PermanentFailure'
        result_string = 'Exception: {}'.format(e)

    finally:
        results.append({
            'taskId': task_id,
            'resultCode': result_code,
            'resultString': result_string
        })
        logger.info(result_code + " # " + result_string)

    return {
        'invocationSchemaVersion': invocation_schema_version,
        'treatMissingKeysAs': 'PermanentFailure',
        'invocationId': invocation_id,
        'results': results
    }


def _submit_job(source_bucket, source_key):

    logger.debug("preflight check start")

    #preflight checks _read_
    pre_flight_response = s3client.head_object(
        Bucket=source_bucket,
        Key=source_key
    )

    logger.debug('## PREFLIGHT_RESPONSE\r' + jsonpickle.encode(dict(**pre_flight_response)))

    if 'DeleteMarker' in pre_flight_response and pre_flight_response['pre_flight_response'] == True:
            raise ObjectDeletedError( source_key + ' is deleted')

    logger.debug("preflight check end")

    unsupported_storage_class = False

    #Storage class check
    if 'StorageClass' in pre_flight_response and pre_flight_response['StorageClass'] in ['GLACIER', 'DEEP_ARCHIVE']:
            #check restore status:
            if 'Restore' in pre_flight_response:
                restore = pre_flight_response['Restore']
                logger.debug(restore)
                if 'ongoing-request="false"' not in restore:
                    logger.info('restore is in progress')
                    raise UnsupportedStorageClassError( source_key + ' is restoring from '  + pre_flight_response['StorageClass'])
            else:
                unsupported_storage_class = True

    if (unsupported_storage_class):
        raise UnsupportedStorageClassError( source_key + ' is in unsupported StorageClass '  + pre_flight_response['StorageClass'])

    #NFC for unicodedata
    if unicodedata.is_normalized('NFC', source_key) == False:
        raise UnsupportedTextFormatError( source_key + ' is not in Normalized Form C' )

    # use bigger containers for 10GB+
    logger.debug("job submission start")
    job_definition = os.environ['JOB_SIZE_SMALL'] if pre_flight_response['ContentLength'] < int(os.environ['JOB_SIZE_THRESHOLD']) else os.environ['JOB_SIZE_LARGE']
    logger.debug("job definition is " + job_definition)

    logger.debug("job submission start")

    #submit job
    response = batchclient.submit_job(
        jobName="Fixity",
        jobQueue=os.environ['JOB_QUEUE'],
        jobDefinition=job_definition,
        parameters={
            'Bucket': source_bucket,
            'Key': source_key
        },
        propagateTags=True,
        tags={
            'Bucket': source_bucket,
            'Key': source_key,
            'Size': str(pre_flight_response['ContentLength'])
        }
    )

    logger.debug('## BATCH_RESPONSE\r' + jsonpickle.encode(dict(**response)))
    logger.debug("job submission complete")

    return response['jobId']

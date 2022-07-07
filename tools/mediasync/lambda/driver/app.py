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

def get_bucket_region(bucket):

    bucket_location_resp = s3client.get_bucket_location(
        Bucket=bucket
    )
    bucket_region=bucket_location_resp['LocationConstraint']
    logger.info("bucket_name="+ bucket +",bucket_region=" + bucket_region)

    return bucket_region

def pre_flight_check(source_bucket, source_key):
    #preflight checks _read_
    logger.debug("preflight check start")

    pre_flight_response = s3client.head_object(
        Bucket=source_bucket,
        Key=source_key
    )
    logger.debug('## PREFLIGHT_RESPONSE\r' + jsonpickle.encode(dict(**pre_flight_response)))
    logger.debug("preflight check end")
    return pre_flight_response


def check_if_deleted(source_key, pre_flight_response):

    if 'DeleteMarker' in pre_flight_response and pre_flight_response['pre_flight_response'] == True:
        raise ObjectDeletedError( source_key + ' is deleted')

def check_if_supported_storage_class(source_key, pre_flight_response):

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

def submit_job(s3_batch_job_id, source_bucket, source_key, destination_bucket, size):

    source_bucket_region = get_bucket_region(source_bucket)

    job_definition = os.environ['JOB_DEFINITION'] if get_bucket_region(destination_bucket) == source_bucket_region else  os.environ['JOB_DEFINITION_X_REGION']

    logger.debug("job submission start")

    #submit job
    response = batchclient.submit_job(
        jobName="MediaSyncJob",
        jobQueue=os.environ['JOB_QUEUE'],
        jobDefinition=job_definition,
        parameters={
            'SourceS3Uri': 's3://' + source_bucket + '/' + source_key,
            'DestinationS3Uri': 's3://' + destination_bucket + '/' + source_key,
            'Size': str(size),
            'SourceBucketRegion': source_bucket_region
        },
        tags={
            'S3BatchJobId': s3_batch_job_id,
            'SourceBucket': source_bucket,
            'DestinationBucket': destination_bucket,
            'Key': source_key,
            'Size': str(size)
        }
    )

    logger.debug('## BATCH_RESPONSE\r' + jsonpickle.encode(dict(**response)))
    logger.debug("job submission complete")

    job_id = '#' if 'jobId' not in response else response['jobId']

    return job_id


def in_place_copy(source_bucket, source_key, destination_bucket):

    copy_response= {}
    copy_response = s3client.copy_object(
        Bucket=destination_bucket,
        CopySource={'Bucket': source_bucket,'Key': source_key},
        Key=source_key
    )

    logger.debug('## COPY_RESPONSE\r' + jsonpickle.encode(dict(**copy_response)))

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

def lambda_handler(event, _):

    logger.debug('## EVENT\r' + jsonpickle.encode(dict(**event)))

    destination_bucket=os.environ['DESTINATION_BUCKET_NAME']

    s3_batch_job_id = event['job']['id']
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

    minsizeforbatch = int(os.environ['MN_SIZE_FOR_BATCH_IN_BYTES'])

    # Copy object to new bucket with new key name
    try:

        pre_flight_response = pre_flight_check(source_bucket, source_key)

        check_if_deleted(source_key, pre_flight_response)
        size = pre_flight_response['ContentLength']

        if (size > minsizeforbatch):

            check_if_supported_storage_class(source_key, pre_flight_response)

            if (is_can_submit_jobs() == False):

                logger.info("too many jobs pending. returning slowdown")
                result_code = 'TemporaryFailure'
                result_string = 'Retry request to batch due to too many pending jobs.'

            else:

                batch_job_id = submit_job(s3_batch_job_id, source_bucket, source_key, destination_bucket, size)
                result_code = 'Succeeded'
                result_string = 'https://console.aws.amazon.com/batch/v2/home?region=' + os.environ['AWS_REGION'] + '#jobs/detail/'+ batch_job_id

        else:
            # <5GB
            in_place_copy(source_bucket, source_key, destination_bucket)
            result_string = 'Lambda copy complete'
            result_code = 'Succeeded'


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

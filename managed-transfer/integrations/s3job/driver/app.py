import os
import logging
import boto3
import json
import urllib
from botocore.exceptions import ClientError
import jsonpickle

from aws_xray_sdk.core import xray_recorder
from aws_xray_sdk.core import patch_all

logger = logging.getLogger()
logger.setLevel(logging.DEBUG)

lambdaclient = boto3.client('lambda')
lambdaclient.get_account_settings()
patch_all()

client = boto3.client('batch')

def lambda_handler(event, context):

    logger.info('## EVENT\r' + jsonpickle.encode(dict(**event)))

    jobId = event['job']['id']
    invocationId = event['invocationId']
    invocationSchemaVersion = event['invocationSchemaVersion']

    taskId = event['tasks'][0]['taskId']
    sourceKey = urllib.parse.unquote(event['tasks'][0]['s3Key'])
    s3BucketArn = event['tasks'][0]['s3BucketArn']
    sourceBucket = s3BucketArn.split(':::')[-1]

    results = []

    # Copy object to new bucket with new key name
    try:
        # Prepare result code and string
        resultCode = None
        resultString = None

        logger.debug("subumitting job")

        #Add preflight checks _read_ + _write_
        destinationBucket=os.environ['DestinationBucketName']

        response = client.submit_job(
            jobName="CopyStartedByS3Batch",
            jobQueue=os.environ['JobQueue'],
            jobDefinition=os.environ['JobDefinition'],
            parameters={
                'SourceS3Uri': 's3://' + sourceBucket + '/' + sourceKey,
                'DestinationS3Uri': 's3://' + destinationBucket + '/' + sourceKey,
            }
        )

        logger.debug("job submission complete")
        # Mark as succeeded
        resultCode = 'Succeeded'
        # resultString = str(response)

    except ClientError as e:
        # If request timed out, mark as a temp failure
        # and S3 Batch Operations will make the task for retry. If
        # any other exceptions are received, mark as permanent failure.
        errorCode = e.response['Error']['Code']
        errorMessage = e.response['Error']['Message']

        logger.debug(errorMessage)

        if errorCode == 'RequestTimeout':
            resultCode = 'TemporaryFailure'
            resultString = 'Retry request to Amazon S3 due to timeout.'
        else:
            resultCode = 'PermanentFailure'
            resultString = '{}: {}'.format(errorCode, errorMessage)

    except Exception as e:
        # Catch all exceptions to permanently fail the task
        resultCode = 'PermanentFailure'
        resultString = 'Exception: {}'.format(e)
        logger.debug(resultString)
        raise e

    finally:
        results.append({
            'taskId': taskId,
            'resultCode': resultCode,
            'resultString': resultString
        })

    return {
        'invocationSchemaVersion': invocationSchemaVersion,
        'treatMissingKeysAs': 'PermanentFailure',
        'invocationId': invocationId,
        'results': results
    }

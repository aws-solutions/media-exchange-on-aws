# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import json
import pytest
import os
import boto3
import time
import requests
import hashlib
import jsonpickle

@pytest.fixture()
def config():

    onboarding_info = {}
    onboarding_info['FILE_NAME'] = '/tmp/media-exchange-test-object'

    with open(onboarding_info['FILE_NAME'], 'wb') as f:
        f.write(os.urandom(1024*100)) #100 KB

    hasher = hashlib.sha256()
    with open(onboarding_info['FILE_NAME'], 'rb') as f:
        hasher.update(f.read())

    onboarding_info['CHECKSUM']  = hasher.hexdigest()

    with open('./publisher.env') as f:
        data = f.read()
        parts = data.split(' ')
        for part in parts:
            v = part.split('=')
            onboarding_info[v[0]] = v[1].strip()

    with open('./subscriber.env') as f:
        data = f.read()
        parts = data.split(' ')
        for part in parts:
            v = part.split('=')
            onboarding_info[v[0]] = v[1].strip()

    #override PUBLISHER_ROLE
    publisher_role = onboarding_info['PUBLISHER_ROLE']
    if publisher_role.endswith(':root'):
         onboarding_info['PUBLISHER_ROLE'] = publisher_role.replace(":root", ":role/publisher-role")

    #override SUBSCRIBER_ROLE
    publisher_role = onboarding_info['SUBSCRIBER_ROLE']
    if publisher_role.endswith(':root'):
         onboarding_info['SUBSCRIBER_ROLE'] = publisher_role.replace(":root", ":role/subscriber-role")

    yield onboarding_info

    os.remove(onboarding_info['FILE_NAME'])


def test_push_pull(config):

    sts = boto3.client("sts")
    resp = sts.assume_role(
        RoleArn=config['PUBLISHER_ROLE'],
        RoleSessionName="mediaexchange-test-session"
    )

    session = boto3.session.Session(aws_access_key_id=resp['Credentials']['AccessKeyId'], aws_secret_access_key=resp['Credentials']['SecretAccessKey'], aws_session_token=resp['Credentials']['SessionToken'], region_name=config['AWS_REGION'])

    s3_client = session.client('s3')
    with open(config['FILE_NAME'], 'rb') as f:
        s3_client.put_object(
            Body=f,
            Bucket=config['MEDIAEXCHANGE_BUCKET_NAME'],
            GrantRead="id="+config['SUBSCRIBER_CANONICAL_USER_ID'],
            Key=config['FILE_NAME']
        )

    resp = s3_client.list_buckets()
    owner_cannonical_id = resp['Owner']['ID']

    resp = s3_client.get_object_acl(
        Bucket=config['MEDIAEXCHANGE_BUCKET_NAME'],
        Key=config['FILE_NAME']
    )

    assert len(resp['Grants']) == 1
    assert resp['Grants'][0]['Grantee']['ID'] == config['SUBSCRIBER_CANONICAL_USER_ID']
    assert resp['Grants'][0]['Grantee']['Type'] == 'CanonicalUser'
    assert resp['Grants'][0]['Permission'] == 'READ'

    assert resp['Owner']['ID'] == owner_cannonical_id

    resp = sts.assume_role(
        RoleArn=config['SUBSCRIBER_ROLE'],
        RoleSessionName="mediaexchange-test-session"
    )

    session = boto3.session.Session(aws_access_key_id=resp['Credentials']['AccessKeyId'], aws_secret_access_key=resp['Credentials']['SecretAccessKey'], aws_session_token=resp['Credentials']['SessionToken'], region_name=config['AWS_REGION'])

    s3_client = session.client('s3')
    resp = s3_client.list_objects_v2(
        Bucket=config['MEDIAEXCHANGE_BUCKET_NAME'],
        FetchOwner=True
    )
    ff = False
    for content in resp['Contents']:
        if content['Key'] == config['FILE_NAME']:
            ff = True
    assert ff == True

    s3 = session.resource('s3')
    object = s3.Object(config['MEDIAEXCHANGE_BUCKET_NAME'],config['FILE_NAME'])
    object.download_file(config['FILE_NAME']+'.1')

    hasher = hashlib.sha256()
    with open(config['FILE_NAME']+'.1', 'rb') as f:
        hasher.update(f.read())

    assert config['CHECKSUM']  == hasher.hexdigest()

    #delete object
    resp = sts.assume_role(
        RoleArn=config['PUBLISHER_ROLE'],
        RoleSessionName="mediaexchange-test-session"
    )

    session = boto3.session.Session(aws_access_key_id=resp['Credentials']['AccessKeyId'], aws_secret_access_key=resp['Credentials']['SecretAccessKey'], aws_session_token=resp['Credentials']['SessionToken'], region_name=config['AWS_REGION'])

    s3_client = session.client('s3')
    s3_client.delete_object(Bucket=config['MEDIAEXCHANGE_BUCKET_NAME'],Key=config['FILE_NAME'])

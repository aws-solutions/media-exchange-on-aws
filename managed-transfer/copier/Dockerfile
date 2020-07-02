FROM amazon/aws-cli

RUN aws configure set default.s3.max_concurrent_requests 50 && aws configure set default.s3.multipart_chunksize 64MB && aws configure set default.s3.max_bandwidth 150MB/s

ADD ./copyPlusSHA256.sh /bin/

ENTRYPOINT []
CMD []

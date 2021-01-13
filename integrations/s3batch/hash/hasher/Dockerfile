FROM amazon/aws-cli:latest

RUN amazon-linux-extras install epel -y \
  && yum update -y \
  && yum install -y \
  xxhash \
  && yum clean all

RUN set default.s3.multipart_chunksize 64MB && aws configure set default.s3.max_bandwidth 512MB/s

COPY ./hash.sh /bin/

ENTRYPOINT ["/bin/hash.sh"]
CMD []

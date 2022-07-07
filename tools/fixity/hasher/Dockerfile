FROM amazon/aws-cli:latest

RUN amazon-linux-extras install epel -y \
  && yum update -y \
  && yum install -y \
  xxhash \
  && yum clean all

ADD s3pcat_0.1.0_linux-amd64.tar.gz /usr/local/bin/

COPY ./hash.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/hash.sh

ENTRYPOINT ["/usr/local/bin/hash.sh"]
CMD []

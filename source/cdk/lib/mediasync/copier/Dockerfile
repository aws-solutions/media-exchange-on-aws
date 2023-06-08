
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0


FROM amazon/aws-cli:latest

COPY stream.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/stream.sh

COPY ssc.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/ssc.sh


RUN aws configure set default.s3.max_concurrent_requests 64 && aws configure set default.s3.multipart_chunksize 64MB

ENTRYPOINT ["/bin/bash"]
CMD []

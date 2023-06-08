#/bin/bash
aws s3 cp $1 - --expected-size $3 --source-region $4 | aws s3 cp - $2 --expected-size $3

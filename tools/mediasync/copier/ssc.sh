#/bin/bash
aws s3 cp $1 $2 --expected-size $3 --source-region $4

FROM public.ecr.aws/lambda/python:3.9
ARG wd=/var/task/
COPY app.py requirements.txt ${wd}
RUN python3.9 -m pip install -r requirements.txt -t "${wd}"
# Command can be overwritten by providing a different command in the template directly.
CMD ["app.lambda_handler"]
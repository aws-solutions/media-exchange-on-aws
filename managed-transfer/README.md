# managed-transfer

This project contains source code and supporting files for a serverless application that you can deploy with the SAM CLI.

## Deploy


```bash
make install
```

## Use the SAM CLI to build and test locally

```bash
make package
```
Test a single function by invoking it directly with a test event. An event is a JSON document that represents the input that the function receives from the event source. Test events are included in the `events` folder in this project.

Run functions locally and invoke them with the `sam local invoke` command.

```bash
sam local invoke DriverFunction --template deployment/s3job.yaml --event events/event.json
```

## Unit tests

Tests are defined in the `tests` folder in this project. Use PIP to install the [pytest](https://docs.pytest.org/en/latest/) and run unit tests.

```bash
pip install pytest pytest-mock --user
python -m pytest tests/ -v
```

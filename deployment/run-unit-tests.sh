#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
# This script should be run from the repo's deployment directory
# cd deployment
# ./run-unit-tests.sh

# Run unit tests
echo "Running unit tests"

# Make sure working directory is the directory containing this script
cd "$(dirname "${BASH_SOURCE[0]}")"


echo "------------------------------------------------------------------------------"
echo "Installing Dependencies And Testing CDK"
echo "------------------------------------------------------------------------------"
# Go to cdk directory
cdk_dir=`cd ../source/cdk; pwd`
custom_resource_dir=`cd ../source/custom-resource; pwd`
cd "${cdk_dir}"

prepare_jest_coverage_report() {
    local component_name=$1

    if [ ! -d "coverage" ]; then
        echo "ValidationError: Missing required directory coverage after running unit tests"
        exit 129
    fi

    # prepare coverage reports
    rm -fr ../coverage/lcov-report
    mkdir -p $coverage_reports_top_path/jest
    coverage_report_path=$coverage_reports_top_path/jest/$component_name
    rm -fr $coverage_report_path
    mv coverage $coverage_report_path
    rm -fr coverage
}

run_cdk_project_test() {
    local component_path="$1"
    local component_path_name="$2"
    local component_name=solutions-constructs-${component_path_name}

    echo "------------------------------------------------------------------------------"
    echo "[Test] $component_name"
    echo "------------------------------------------------------------------------------"
    cd "$component_path"

    # install and build for unit testing
    npm install

    # run unit tests
    npm run test

    # prepare coverage reports
    prepare_jest_coverage_report $component_name
}

# Get reference for source folder
slnroot_dir="$(dirname "$cdk_dir")"
coverage_reports_top_path="../coverage-reports"

# Test the CDK project
run_cdk_project_test "$cdk_dir" "cdk"
run_cdk_project_test "$custom_resource_dir" "custom"

# Make sure we clean up
cleanup_before_exit() {
    cleanup $?
}

cleanup() {
    # Reset the signals to default behavior
    trap - SIGINT SIGTERM EXIT
    echo "------------------------------------------------------------------------------"
    echo "Cleaning up"
    echo "------------------------------------------------------------------------------"

    # Deactivate and remove the temporary python virtualenv used to run this script
    deactivate
    rm -rf $VENV
    rm -rf  __pycache__
    rm -rf  .pytest_cache
    exit ${1:-0}
}

# Create and activate a temporary Python environment for this script.

echo "------------------------------------------------------------------------------"
echo "Creating a temporary Python virtualenv for this script"
echo "------------------------------------------------------------------------------"
if [ -n "${VIRTUAL_ENV:-}" ]; then
    echo "ERROR: Do not run this script inside Virtualenv. Type \`deactivate\` and run again.";
    exit 1;
fi
if ! command -v python3 &>/dev/null; then
    echo "ERROR: install Python3 before running this script"
    exit 1
fi
VENV=$(mktemp -d)
python3 -m venv $VENV
source $VENV/bin/activate

# Trap exits so we are sure to clean up the virtual environment
trap cleanup_before_exit SIGINT SIGTERM EXIT

# Install packages into the virtual environment
pushd ../../source
pip3 install \
    moto \
    mock \
    coverage \
    pylint \
    pytest \
    jsonpickle \
popd

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install required Python libraries."
    exit 1
fi


# Unit tests for python lambdas
source_dir=`cd ../source; pwd`
coverage_report_path_var="../source/coverage.xml"
coverage run -m pytest
coverage xml -i
sed -i.orig -e "s,<source>$source_dir,<source>source,g" $coverage_report_path_var
rm -f ../source/*.orig
mv $coverage_report_path_var coverage-reports/coverage.xml



cleanup $?
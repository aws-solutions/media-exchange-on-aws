#!/bin/bash
#
# This assumes all of the OS-level configuration has been completed and git repo has already been cloned
#
# This script should be run from the repo's deployment directory
# cd deployment
# ./build-s3-dist.sh source-bucket-base-name solution-name version-code
#
# Paramenters:
#  - source-bucket-base-name: Name for the S3 bucket location where the template will source the Lambda
#    code from. The template will append '-[region_name]' to this bucket name.
#    For example: ./build-s3-dist.sh solutions v1.0.0
#    The template will then expect the source code to be located in the solutions-[region_name] bucket
#
#  - solution-name: name of the solution for consistency
#
#  - version-code: version of the package

# Check to see if input has been provided:
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo "Please provide the base source bucket name, trademark approved solution name and version where the lambda code will eventually reside."
    echo "For example: ./build-s3-dist.sh solutions trademarked-solution-name v1.0.0"
    exit 1
fi

# Get reference for all important folders
template_dir="$PWD"
template_dist_dir="$template_dir/global-s3-assets"
build_dist_dir="$template_dir/regional-s3-assets"
source_dir="$template_dir/../source"

echo "------------------------------------------------------------------------------"
echo "[Init] Clean old dist, node_modules and bower_components folders"
echo "------------------------------------------------------------------------------"
echo "rm -rf $template_dist_dir"
rm -rf $template_dist_dir
echo "mkdir -p $template_dist_dir"
mkdir -p $template_dist_dir
echo "rm -rf $build_dist_dir"
rm -rf $build_dist_dir
echo "mkdir -p $build_dist_dir"
mkdir -p $build_dist_dir

echo "------------------------------------------------------------------------------"
echo "[Packing] Templates"
echo "------------------------------------------------------------------------------"
# echo "cp $template_dir/*.template $template_dist_dir/"
# cp $template_dir/*.template $template_dist_dir/
echo "copy yaml templates and rename"
echo "cp $template_dir/*.yaml $template_dist_dir/"
cp $template_dir/*.yaml $template_dist_dir/
echo "cd $template_dist_dir"
cd $template_dist_dir

# Rename all *.yaml to *.template
for f in *.yaml; do
    mv -- "$f" "${f%.yaml}.template"
done

echo "cd .."
cd ..
echo "ls $template_dist_dir/"
ls $template_dist_dir/

echo "Updating code source bucket in template with $1"
replace="s/__BUCKET_NAME__/$1/g"
echo "sed -i -e $replace $template_dist_dir/*.template"
sed -i -e $replace $template_dist_dir/*.template
replace="s/__SOLUTION_NAME__/$2/g"
echo "sed -i -e $replace $template_dist_dir/*.template"
sed -i -e $replace $template_dist_dir/*.template
replace="s/__VERSION__/$3/g"
echo "sed -i -e $replace $template_dist_dir/*.template"
sed -i -e $replace $template_dist_dir/*.template

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Creating Dummy File"
echo "------------------------------------------------------------------------------"
# the build process needs something to exist in the $build_dist_dir or it will break
echo "copying /tmp/dummy.txt to $build_dist_dir"
echo "This dummy file is created to satisfy the requirement of the deployment/regional-s3-assets/ directory existing for the build process. This is not needed for the solution to function." > /tmp/dummy.txt
cp /tmp/dummy.txt $build_dist_dir/dummy.txt

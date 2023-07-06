#!/bin/bash
#
# This script will perform the following tasks:
#   1. Remove any old dist files from previous runs.
#   2. Install dependencies for the cdk-solution-helper; responsible for
#      converting standard 'cdk synth' output into solution assets.
#   3. Build and synthesize your CDK project.
#   4. Run the cdk-solution-helper on template outputs and organize
#      those outputs into the /global-s3-assets folder.
#   5. Organize source code artifacts into the /regional-s3-assets folder.
#   6. Remove any temporary files used for staging.
#
# This script should be run from the repo's deployment directory
# cd deployment
# ./build-s3-dist.sh dist-bucket-name source-bucket-base-name solution-name version-code
#
# Parameters:
#  - dist-bucket-base-name: Name for the S3 bucket location where the assets are
#  - source-bucket-base-name: Name for the S3 bucket location where the template will source the Lambda
#    code from. The template will append '-[region_name]' to this bucket name.
#    For example: ./build-s3-dist.sh solutions my-solution v1.0.0
#    The template will then expect the source code to be located in the solutions-[region_name] bucket
#  - solution-name: name of the solution for consistency
#  - version-code: version of the package
[ "$DEBUG" == 'true' ] && set -x
set -e

# Check to see if input has been provided:
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ] || [ -z "$4" ]; then
    echo "Please provide all required parameters for the build script"
    echo "For example: ./build-s3-dist.sh solutions solutions-reference trademarked-solution-name v1.0.0"
    exit 1
fi

asset_bucket_name="$1"
bucket_name="$2"
solution_name="$3"
solution_version="$4"

# Get reference for all important folders
template_dir="$PWD"
staging_dist_dir="$template_dir/staging"
template_dist_dir="$template_dir/global-s3-assets"
build_dist_dir="$template_dir/regional-s3-assets"
source_dir="$template_dir/../source"
tools_dir_autoingest="$template_dir/../source/cdk/lib/autoingest/deployment"
tools_dir_mediasync="$template_dir/../source/cdk/lib/mediasync/deployment"
tools_dir_fixity="$template_dir/../source/cdk/lib/fixity/deployment"

echo "------------------------------------------------------------------------------"
echo "[Init] Remove any old dist files from previous runs"
echo "------------------------------------------------------------------------------"
rm -rf $template_dist_dir
mkdir -p $template_dist_dir

rm -rf $build_dist_dir
mkdir -p $build_dist_dir

rm -rf $staging_dist_dir
mkdir -p $staging_dist_dir


echo "------------------------------------------------------------------------------"
echo "[Synth] CDK Project"
echo "------------------------------------------------------------------------------"
cd $source_dir/cdk
npm install
npx aws-cdk synth --output=$staging_dist_dir
if [ $? -ne 0 ]
then
    echo "******************************************************************************"
    echo "cdk-nag found errors"
    echo "******************************************************************************"
    exit 1
fi

cd $staging_dist_dir
rm tree.json manifest.json cdk.out

echo "------------------------------------------------------------------------------"
echo "Run Cdk Helper and update template placeholders"
echo "------------------------------------------------------------------------------"

mv MEStack.template.json $template_dist_dir/$solution_name.template
mv SubscriberStack.template.json $template_dist_dir/subscriber.template
mv PublisherStack.template.json $template_dist_dir/publisher.template
mv ProvisionStack.template.json $template_dist_dir/provision.template
mv AgreementStack.template.json $template_dist_dir/agreement.template

# Get asset folder names dynamically
fixityAsset=$(jq -r 'first(.Resources | to_entries[] | select(.key | startswith("DriverFunction"))) | .value | .Metadata | ."aws:asset:path"' FixityStack.template.json)
MediaSyncAsset=$(jq -r 'first(.Resources | to_entries[] | select(.key | startswith("MediaSyncDriverFunction"))) | .value | .Metadata | ."aws:asset:path"' MediaSyncStack.template.json)
AutoIngestAsset=$(jq -r 'first(.Resources | to_entries[] | select(.key | startswith("DriverFunction"))) | .value | .Metadata | ."aws:asset:path"' AutoIngestStack.template.json)

cd $template_dir/../source/cdk/lib/autoingest
mkdir -p deployment
cd $template_dir/../source/cdk/lib/mediasync
mkdir -p deployment
cd $template_dir/../source/cdk/lib/fixity
mkdir -p deployment

cd $staging_dist_dir
mv FixityRepositoryStack.template.json $tools_dir_fixity/fixity-repository.json
mv FixityStack.template.json $tools_dir_fixity/fixity.json
cp -R $fixityAsset $tools_dir_fixity/../

mv MediaSyncRepositoryStack.template.json $tools_dir_mediasync/mediasync-repository.json
mv MediaSyncStack.template.json $tools_dir_mediasync/mediasync.json
cp -R $MediaSyncAsset $tools_dir_mediasync/../

mv AutoIngestStack.template.json $tools_dir_autoingest/autoingest.json
cp -R $AutoIngestAsset $tools_dir_autoingest/../

# Run the helper to clean-up the templates
echo "Run the helper to clean-up the templates"
echo "node $template_dir/cdk-solution-helper/index"
node $template_dir/cdk-solution-helper/index \
    || die "(cdk-solution-helper) ERROR: there is likely output above." $?

for file in $template_dist_dir/*.template
do
    replace="s/__ASSET_BUCKET_NAME__/$asset_bucket_name/g"
    sed -i.orig -e $replace $file
    
    replace="s/__BUCKET_NAME__/$bucket_name/g"
    sed -i.orig -e $replace $file

    replace="s/__SOLUTION_NAME__/$solution_name/g"
    sed -i.orig -e $replace $file

    replace="s/__VERSION__/$solution_version/g"
    sed -i.orig -e $replace $file
done

echo "------------------------------------------------------------------------------"
echo "[Packing] Source code artifacts"
echo "------------------------------------------------------------------------------"
# ... For each asset.* source code artifact in the temporary /staging folder...
cd $staging_dist_dir
for d in `find . -mindepth 1 -maxdepth 1 -type d`; do
    # Rename the artifact, removing the period for handler compatibility
    pfname="$(basename -- $d)"
    # Skip optional assets for deployment
    if [ "$pfname" != *"$fixityAsset"* ] && [ "$pfname" != *"$MediaSyncAsset"* ] && [ "$pfname" != *"$AutoIngestAsset"* ];then
        fname="$(echo $pfname | sed -e 's/\.//g')"
        mv $d $fname

        # Zip artifacts from asset folder
        cd $fname
        rm -rf node_modules/
        if [ -f "package.json" ]
        then
            npm install --production
        fi
        zip -rq ../$fname.zip *
        cd ..

        # Copy the zipped artifact from /staging to /regional-s3-assets
        mv $fname.zip $build_dist_dir
    fi
done

echo "------------------------------------------------------------------------------"
echo "[Cleanup]  Remove temporary files"
echo "------------------------------------------------------------------------------"
rm -rf $staging_dist_dir
rm -f $template_dist_dir/*.orig

echo "------------------------------------------------------------------------------"
echo "S3 Packaging Complete"
echo "------------------------------------------------------------------------------"

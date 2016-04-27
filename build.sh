#!/bin/sh
#
# Script for building the unified modules + plugin for Hyperloop
#
SCRIPT_PATH=$(dirname $0)
cd $SCRIPT_PATH

npm install

rm -rf dist
mkdir dist

VERSION=`grep "^\s*\"version\":" package.json | cut -d ":" -f2 | cut -d "\"" -f2`
# Replace manifest with manifest.bak if it exists!
if [ -d "./android/manifest.bak" ]
then
  git checkout -- ./android/manifest
fi
if [ -d "./iphone/manifest.bak" ]
then
  git checkout -- ./iphone/manifest
fi
# Force the version into the manifest files in iphone/android directories!
sed -i.bak 's/VERSION/'"$VERSION"'/g' ./android/manifest
sed -i.bak 's/VERSION/'"$VERSION"'/g' ./iphone/manifest

echo "Building Android module..."
cd android
#These dirs need to exist for TRAVIS CI. Only create if doesn't exist
mkdir -p ./lib
mkdir -p ./build
mkdir -p ./build/docs
rm -rf dist
ant test dist
if [ $? -ne 0 ];
then
	exit $?
fi
cp dist/*.zip ../dist
cd ..

echo "Unzipping Android zipfile..."
cd dist
unzip hyperloop-android-$VERSION.zip
rm hyperloop-android-$VERSION.zip
cd ..

echo "Building iOS module..."
cd iphone
rm -rf hyperloop-iphone-*.zip
./build.sh
if [ $? -ne 0 ];
then
	exit $?
fi
cp -R build/zip/modules/ ../dist/modules
cp -R build/zip/plugins/ ../dist/plugins/
cd ..

echo "Creating combined zip with iOS and Android"
cd dist
zip -q -r hyperloop-$VERSION.zip *
rm -rf modules
rm -rf plugins
echo "Combined zip completed successfully"
exit 0

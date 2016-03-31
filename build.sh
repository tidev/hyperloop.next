#!/bin/sh
#
# Script for building the unified modules + plugin for Hyperloop
#
SCRIPT_PATH=$(dirname $0)
cd $SCRIPT_PATH

rm -rf dist
mkdir dist

echo "Building Android module..."
cd android
ant
if [ $? -ne 0 ];
then
	exit $?
fi
cp dist/*.zip ../dist
cd ..

echo "Unzipping Android zipfile..."
cd dist
unzip hyperloop-android-*.zip
rm hyperloop-android-*.zip
cd ..

echo "Building iOS module..."
cd iphone
VERSION=`grep "^version:" manifest | cut -c 10-`
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

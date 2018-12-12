#!/bin/sh
#
# Script buid building and packaging the Hyperloop iOS package
#
CWD=`pwd`
CURVERSION=`grep "^version:" manifest`
VERSION=`grep "^version:" manifest | cut -c 10-`
METABASE_VERSION=`grep "\"version\":" ../packages/hyperloop-ios-metabase/package.json | cut -d \" -f 4`
export TITANIUM_SDK="`node ../tools/tiver.js`"

echo "Titanium SDK version: "
echo $TITANIUM_SDK

XC=`which xcpretty`
CHECK="✓ "

if [ $? -eq 1 ];
then
	gem install xcpretty
fi

rm -rf build

# Inject the TITANIUM_SDK value into titanium.xcconfig explicitly, just exporting the value doesn't override it, it seems
sed -i.bak 's@TITANIUM_SDK = .*@TITANIUM_SDK = '"$TITANIUM_SDK"'@g' ./titanium.xcconfig

if [ "${CI}" = "1" ];
then
	echo "Testing ..."
	xcodebuild clean >/dev/null
	xcodebuild -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 6' -scheme hyperloop -target Tests -configuration Debug GCC_PREPROCESSOR_DEFINITIONS='USE_JSCORE_FRAMEWORK=1' test | xcpretty -r junit
	if [ $? -ne 0 ];
	then
		exit $?
	fi
fi

# Build the native module
echo "\nBuilding module ..."
mkdir -p build/zip
ti build -p ios --build-only
cd dist
unzip hyperloop-iphone-$VERSION.zip -d ../build/zip
cd ..

# Package the metabase into the .zip
echo "Packaging iOS metabase..."
cd ../packages/hyperloop-ios-metabase
rm *.tgz
npm pack >/dev/null 2>&1
cd $CWD

# Install dependencies
echo "Installing npm dependencies..."
cd build/zip/modules/iphone/hyperloop/$VERSION/hooks
npm i --production
npm i $CWD/../packages/hyperloop-ios-metabase/hyperloop-metabase-$METABASE_VERSION.tgz
rm -rf node_modules/findit/test
rm -rf package-lock.json
cd $CWD

cd $CWD/build/zip
rm -rf $CWD/hyperloop-iphone-$VERSION.zip
zip -q -r $CWD/hyperloop-iphone-$VERSION.zip * --exclude=*test* --exclude=*.DS_Store* --exclude=*.git* --exclude *.travis.yml*  --exclude *.gitignore*  --exclude *.npmignore* --exclude *CHANGELOG* --exclude *.jshintrc*

unset TITANIUM_SDK

echo "$CHECK Done packaging iOS module!\n"
exit 0

#!/bin/sh
#
# Script buid building and packaging the Hyperloop iOS package
#
CWD=`pwd`
METABASE=$CWD/build/zip/plugins/hyperloop/node_modules/hyperloop-metabase
CURVERSION=`grep "^version:" manifest`
VERSION=`grep "^version:" manifest | cut -c 10-`
export TITANIUM_SDK="`node ../tools/tiver.js`"

XC=`which xcpretty`
CHECK="✓ "

if [ $? -eq 1 ];
then
	gem install xcpretty
fi

rm -rf build

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

mkdir -p build/zip/modules/iphone/hyperloop/$VERSION
mkdir -p build/zip/plugins/hyperloop/hooks/ios
cp manifest module.xcconfig build/zip/modules/iphone/hyperloop/$VERSION

# Build for the Apple JavaScriptCore built-in
echo "\nBuilding for JSCore ..."
xcodebuild clean >/dev/null
xcodebuild -sdk iphoneos -configuration Release GCC_PREPROCESSOR_DEFINITIONS='TIMODULE=1 USE_JSCORE_FRAMEWORK=1' ONLY_ACTIVE_ARCH=NO | xcpretty
xcodebuild -sdk iphonesimulator -configuration Debug GCC_PREPROCESSOR_DEFINITIONS='TIMODULE=1 USE_JSCORE_FRAMEWORK=1' ONLY_ACTIVE_ARCH=NO | xcpretty
lipo build/Debug-iphonesimulator/libhyperloop.a build/Release-iphoneos/libhyperloop.a -create -output build/zip/modules/iphone/hyperloop/$VERSION/libhyperloop-jscore.a >/dev/null 2>&1

# Build for the Titanium custom JavaScriptCore
echo "\nBuilding for TiJSCore ..."
xcodebuild clean >/dev/null
xcodebuild -sdk iphoneos -configuration Release GCC_PREPROCESSOR_DEFINITIONS='TIMODULE=1' ONLY_ACTIVE_ARCH=NO | xcpretty
xcodebuild -sdk iphonesimulator -configuration Debug GCC_PREPROCESSOR_DEFINITIONS='TIMODULE=1' ONLY_ACTIVE_ARCH=NO | xcpretty
lipo build/Debug-iphonesimulator/libhyperloop.a build/Release-iphoneos/libhyperloop.a -create -output build/zip/modules/iphone/hyperloop/$VERSION/libhyperloop-ticore.a

echo "\nPackaging iOS module..."

cp ../plugins/hyperloop.js build/zip/plugins/hyperloop/hooks/hyperloop.js
cp plugin/hyperloop.js build/zip/plugins/hyperloop/hooks/ios
cp plugin/filter.sh build/zip/plugins/hyperloop/hooks/ios
cp -R ../node_modules build/zip/plugins/hyperloop/node_modules
cp ../LICENSE build/zip/plugins/hyperloop
cp ../LICENSE build/zip/modules/iphone/hyperloop/$VERSION

# package the metabase into the .zip
echo "Packaging metabase..."
cd ../metabase/ios
./build.sh >/dev/null
rm *.tgz
npm pack >/dev/null 2>&1
mkdir -p $CWD/build/npm
cp *.tgz $CWD/build/npm
cd $CWD/build/npm
tar xfz *.tgz
rm -rf *.tgz
cd package
npm i --production >/dev/null 2>&1
rm -rf unittest
mkdir -p $METABASE
cp -R * $METABASE
rm -rf $METABASE/hyperloop-metabase.xcodeproj $METABASE/hyperloop-metabase.xcodeproj $METABASE/src $METABASE/unittest $METABASE/include $METABASE/build

# titanium requires at least this file so just create an empty one
echo 1 > $CWD/build/zip/modules/iphone/hyperloop/$VERSION/libhyperloop.a

cd $CWD/build/zip
rm -rf $CWD/hyperloop-iphone-$VERSION.zip
zip -q -r $CWD/hyperloop-iphone-$VERSION.zip * --exclude=*test* --exclude=*.DS_Store* --exclude=*.git* --exclude *.travis.yml*  --exclude *.gitignore*  --exclude *.npmignore* --exclude *CHANGELOG* --exclude *.jshintrc*

unset TITANIUM_SDK

echo "$CHECK Done packaging iOS module!\n"
exit 0

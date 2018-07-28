#!/bin/sh
#
# Script buid building and packaging the Hyperloop iOS package
#
CWD=`pwd`
CURVERSION=`grep "^version:" manifest`
VERSION=`grep "^version:" manifest | cut -c 10-`

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
cp manifest module.xcconfig build/zip/modules/iphone/hyperloop/$VERSION

# Build for the Apple JavaScriptCore built-in
echo "\nBuilding for JSCore ..."
xcodebuild clean >/dev/null
xcodebuild -sdk iphoneos -configuration Release GCC_PREPROCESSOR_DEFINITIONS='TIMODULE=1 USE_JSCORE_FRAMEWORK=1' ONLY_ACTIVE_ARCH=NO | xcpretty
[[ ${PIPESTATUS[0]} -ne 0 ]] && exit 1
xcodebuild -sdk iphonesimulator -configuration Debug GCC_PREPROCESSOR_DEFINITIONS='TIMODULE=1 USE_JSCORE_FRAMEWORK=1' ONLY_ACTIVE_ARCH=NO | xcpretty
[[ ${PIPESTATUS[0]} -ne 0 ]] && exit 1
lipo build/Debug-iphonesimulator/libhyperloop.a build/Release-iphoneos/libhyperloop.a -create -output build/zip/modules/iphone/hyperloop/$VERSION/libhyperloop-jscore.a

# Build for the Titanium custom JavaScriptCore
echo "\nBuilding for TiJSCore ..."
xcodebuild clean >/dev/null
xcodebuild -sdk iphoneos -configuration Release GCC_PREPROCESSOR_DEFINITIONS='TIMODULE=1' ONLY_ACTIVE_ARCH=NO | xcpretty
[[ ${PIPESTATUS[0]} -ne 0 ]] && exit 1
xcodebuild -sdk iphonesimulator -configuration Debug GCC_PREPROCESSOR_DEFINITIONS='TIMODULE=1' ONLY_ACTIVE_ARCH=NO | xcpretty
[[ ${PIPESTATUS[0]} -ne 0 ]] && exit 1
lipo build/Debug-iphonesimulator/libhyperloop.a build/Release-iphoneos/libhyperloop.a -create -output build/zip/modules/iphone/hyperloop/$VERSION/libhyperloop-ticore.a

# Install dependencies
echo "Installing npm dependencies..."
cd hooks
npm i --production
rm -rf node_modules/findit/test
# FIXME: We're manually removing crap here. Why doesn't it use npmignore when using file reference for dependency? So it can symlink?
# We could do: `npx npm-ignore-delete delete node_modules/hyperloop-metabase` if that package gets the bug fixed!
# Or I guess we can go back to npm pack? But then how do we handle the file uri in hook's package.json?
rm -rf node_modules/hyperloop-metabase/build
rm -rf node_modules/hyperloop-metabase/coverage
rm -rf node_modules/hyperloop-metabase/data
rm -rf node_modules/hyperloop-metabase/hyperloop-metabase.xcodeproj
rm -rf node_modules/hyperloop-metabase/include
rm -rf node_modules/hyperloop-metabase/src
rm -rf node_modules/hyperloop-metabase/test
rm -rf node_modules/hyperloop-metabase/tmp
rm -rf node_modules/hyperloop-metabase/unittest
rm -rf node_modules/hyperloop-metabase/build.sh
rm -rf node_modules/hyperloop-metabase/Gruntfile.js
rm -rf node_modules/hyperloop-metabase/junit_report.xml
rm -rf node_modules/hyperloop-metabase/package-lock.json
rm -rf node_modules/hyperloop-metabase/run.sh
rm -rf node_modules/hyperloop-metabase/retirejs.output.json
cd $CWD

echo "\nPackaging iOS module..."
# Need to copy recursively *AND* follow symlinks! symlink is used to point at hyperloop-metabase package!
cp -RL hooks build/zip/modules/iphone/hyperloop/$VERSION
cp -R ../hooks build/zip/modules/iphone/hyperloop/$VERSION
rm -rf build/zip/modules/iphone/hyperloop/$VERSION/hooks/test
rm -rf build/zip/modules/iphone/hyperloop/$VERSION/hooks/Gruntfile.js
rm -rf build/zip/modules/iphone/hyperloop/$VERSION/hooks/NOTES.md
cp ../LICENSE build/zip/modules/iphone/hyperloop/$VERSION

# titanium requires at least this file so just create an empty one
echo 1 > $CWD/build/zip/modules/iphone/hyperloop/$VERSION/libhyperloop.a

cd $CWD/build/zip
rm -rf $CWD/hyperloop-iphone-$VERSION.zip
zip -q -r $CWD/hyperloop-iphone-$VERSION.zip * --exclude=*test* --exclude=*.DS_Store* --exclude=*.git* --exclude *.travis.yml*  --exclude *.gitignore*  --exclude *.npmignore* --exclude *CHANGELOG* --exclude *.jshintrc* --exclude *package-lock.json*

echo "$CHECK Done packaging iOS module!\n"
exit 0

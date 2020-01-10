#!/bin/bash
#
# Script for building the unified modules + plugin for Hyperloop
#
SCRIPT_PATH=$(cd "$(dirname "$0")"; pwd)
cd $SCRIPT_PATH

onexit () {
	cd $SCRIPT_PATH

	# Reset the generated version of the manifest to VERSION
	git checkout HEAD -- android/manifest
	git checkout HEAD -- android/build.properties
	git checkout HEAD -- iphone/manifest
	#git checkout HEAD -- iphone/titanium.xcconfig
	rm -rf $SCRIPT_PATH/iphone/*.bak
	rm -rf $SCRIPT_PATH/android/*.bak
}

trap onexit 0 1 2 3 6 9 15

TISDK_SEMVER=">=7.0.0"
CHECK="✓ "

# Make sure the Android SDK is installed
if [ "$ANDROID_SDK" = "" ];
then
	if [ -d ~/Library/Android/sdk ];
	then
		export ANDROID_SDK=~/Library/Android/sdk
	else
		echo "Please set ANDROID_SDK environment variable and try again"
		echo "Download Android SDK from http://developer.android.com/sdk/index.html"
		exit 1
	fi
	echo "$CHECK Android SDK is $ANDROID_SDK"
fi

# Make sure we have at least the Android 8.1 (SDK 27) installed
if [ ! -d "$ANDROID_SDK/platforms/android-27" ];
then
	echo "Android 8.1 (Lollipop) / (android-27) not installed"
	echo "Download Android 8.1 using Android Studio"
	exit 1
fi

# Use the default NDK-bundle if no one is specified
if [ "$ANDROID_NDK" = "" ];
then
	export ANDROID_NDK=$ANDROID_SDK/ndk-bundle
fi

# Make sure the Android NDK is installed
if [ ! -f "$ANDROID_NDK/ndk-build" ];
then
	echo "Android NDK not installed"
	echo "Download Android NDK Tools using Android Studio"
	exit 1
fi

# Make sure xcpretty is installed
XC=$(xcpretty --version)

if [ ! $? -eq 0 ];
then
	echo "xcpretty not installed"
	echo "Download by running sudo gem install xcpretty"
	exit 1
fi

# Update our node-dependencies
npm install

# Receive the current Titanium SDK version
TISDK=$(node ./tools/tiver.js -minsdk "$TISDK_SEMVER")

if [ $? -eq 1 ];
then
	echo "Minimum Titanium SDK not found. Must be $TISDK_SEMVER, current active SDK is: $TISDK"
	exit 1
else
	echo "$CHECK Current Titanium SDK is $TISDK"
fi

# Flush dist/ directory
rm -rf dist
mkdir dist

# Receive the current Hyperloop version from our manifest.json
VERSION=`grep "^\s*\"version\":" package.json | cut -d ":" -f2 | cut -d "\"" -f2`

# Force the version into the manifest files in iphone/android directories!
sed -i.bak 's/VERSION/'"$VERSION"'/g' ./android/manifest
sed -i.bak 's/VERSION/'"$VERSION"'/g' ./iphone/manifest

# Build Android module
echo "Building Android module..."
cd android

# These dirs need to exist for TRAVIS CI. Only create if doesn't exist
mkdir -p ./lib
rm -rf build/*
rm -rf libs/*
mkdir -p ./build
mkdir -p ./build/docs
rm -rf dist
appc run -p android --build-only
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

# Builds iOS module
echo "Building iOS module..."
cd iphone
rm -rf build
rm -rf hyperloop-iphone-*.zip
./build.sh

if [ $? -ne 0 ];
then
	exit $?
fi

cp -R build/zip/modules/ ../dist/modules
cd ..

# Combine all modules to one masterpiece
echo "Creating combined zip with iOS andAndroid..."
cd dist
zip -q -r hyperloop-$VERSION.zip *

echo "$CHECK Combined zip completed successfully"
echo "$CHECK Distribution is available at dist/hyperloop-$VERSION.zip"
exit 0

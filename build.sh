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
	git checkout HEAD -- iphone/manifest
	git checkout HEAD -- iphone/titanium.xcconfig
	rm -rf $SCRIPT_PATH/iphone/*.bak
	rm -rf $SCRIPT_PATH/android/*.bak
}

trap onexit 0 1 2 3 6 9 15

CHECK="✓ "

# Make sure the Android SDK is installed
if [ "$ANDROID_SDK" = "" ];
then
	if [ -d ~/Library/Android/sdk ];
	then
		export ANDROID_SDK=~/Library/Android/sdk
	else
		echo "Please set ANDROID_SDK environment variable and try again"
		echo "Download Android Studio from https://developer.android.com/studio"
		exit 1
	fi
	echo "$CHECK Android SDK is $ANDROID_SDK"
fi

# Make sure we have at least the Android 7.1 (SDK 25) installed
if [ ! -d "$ANDROID_SDK/platforms/android-35" ];
then
	echo "Android 15 / (android-35) not installed"
	echo "Download the Android 15 SDK using Android Studio"
	exit 1
fi

# Use the default NDK if none is specified
if [ "$ANDROID_NDK" = "" ];
then
	if [ -d "$ANDROID_SDK/ndk" ];
	then
		export ANDROID_NDK=$(ls -d $ANDROID_SDK/ndk/*/ 2>/dev/null | sort -V | tail -1)
		if [ -z "$ANDROID_NDK" ] || [ ! -f "$ANDROID_NDK/ndk-build" ];
		then
			echo "Android NDK not found under $ANDROID_SDK/ndk/"
			exit 1
		fi
	else
		export ANDROID_NDK=$ANDROID_SDK/ndk-bundle
	fi
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

cd hooks
npm install
cd ..

# These dirs need to exist for TRAVIS CI. Only create if doesn't exist
mkdir -p ./lib
rm -rf build/*
rm -rf libs/*
mkdir -p ./build
mkdir -p ./build/docs
rm -rf dist
ti build -p android --build-only
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

cd hooks
npm install
cd ..

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

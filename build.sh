#!/bin/bash
#
# Script for building the unified modules + plugin for Hyperloop
#
SCRIPT_PATH=$(cd "$(dirname "$0")"; pwd)
cd $SCRIPT_PATH

onexit () {
	cd $SCRIPT_PATH
	git checkout android/manifest
	git checkout android/build.properties
	git checkout iphone/manifest
	git checkout iphone/titanium.xcconfig
	rm -rf $SCRIPT_PATH/iphone/*.bak
	rm -rf $SCRIPT_PATH/android/*.bak
}

trap onexit 0 1 2 3 6 9 15

TISDK_SEMVER=">=5.4.0"
CHECK="✓ "

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

if [ ! -d "$ANDROID_SDK/platforms/android-21" ];
then
	echo "Android 5.0 (Lollipop) / (android-21) not installed"
	echo "Download Android 5.0 using the Android SDK Manager"
	exit 1
fi

if [ "$ANDROID_NDK" = "" ];
then
	export ANDROID_NDK=$ANDROID_SDK/ndk-bundle
fi

# make sure we have NDK
if [ ! -f "$ANDROID_NDK/ndk-build" ];
then
	echo "Android NDK not installed"
	echo "Download Android NDK Tools using the Android SDK Manager"
	exit 1
fi

XC=$(xcpretty --version)

if [ ! $? -eq 0 ];
then
	echo "xcpretty not installed"
	echo "Download by running sudo gem install xcpretty"
	exit 1
fi


npm install

TISDK=$(node ./tools/tiver.js -minsdk "$TISDK_SEMVER")

if [ $? -eq 1 ];
then
	echo "Minimum Titanium SDK not found. Must be $TISDK_SEMVER, current active SDK is: $TISDK"
	exit 1
else
	echo "$CHECK Current Titanium SDK is $TISDK"
fi

rm -rf dist
mkdir dist

VERSION=`grep "^\s*\"version\":" package.json | cut -d ":" -f2 | cut -d "\"" -f2`
# Replace manifest with manifest.bak if it exists!
if [ -f "./android/build.properties.bak" ]
then
  git checkout android/build.properties
fi
if [ -f "./iphone/manifest.bak" ]
then
  git checkout iphone/manifest
fi
if [ -f "./iphone/titanium.xcconfig.bak" ]
then
  git checkout iphone/titanium.xcconfig
fi
# Force the version into the manifest files in iphone/android directories!
sed -i.bak 's/VERSION/'"$VERSION"'/g' ./android/manifest
sed -i.bak 's/VERSION/'"$VERSION"'/g' ./iphone/manifest
sed -i.bak 's/5.4.0/'"$TISDK"'/g' ./android/build.properties
sed -i.bak 's/5.4.0/'"$TISDK"'/g' ./iphone/titanium.xcconfig


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
mkdir -p temp
cp -R plugins/hyperloop/* temp
rm -rf plugins
mkdir -p plugins/hyperloop/versions/$VERSION
cp -R temp/* plugins/hyperloop/versions/$VERSION
rm -rf temp
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
mkdir -p temp
cp -R plugins/hyperloop/* temp
rm -rf plugins
mkdir -p plugins/hyperloop/$VERSION
cp -R temp/* plugins/hyperloop/$VERSION
rm -rf temp
zip -q -r hyperloop-$VERSION.zip *
rm -rf modules
rm -rf plugins

echo "$CHECK Combined zip completed successfully"
echo "$CHECK Distribution is available at dist/hyperloop-$VERSION.zip"
exit 0

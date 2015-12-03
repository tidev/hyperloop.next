rm -rf dist
mkdir dist

echo "Building Android module..."
cd android
ant
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
cp -R build/zip/modules/iphone ../dist/modules
cp -R build/zip/plugins/hyperloop ../dist/plugins/
cd ..

echo "Creating combined zip with iOS and Android"
cd dist
zip -q -r hyperloop-$VERSION.zip *
rm -rf modules
rm -rf plugins

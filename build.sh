mkdir dist

cd android
ant
cp dist/*.zip ../dist

cd ..
cd iphone
./build.sh
cp dist/*.zip ../dist
cd ..

# TODO Combine the zips!

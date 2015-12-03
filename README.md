Hyperloop module
===========================================

## Requirements

* Titanium SDK 5.2.0 or greater

For iOS:
*

For Android:
* JDK 6+
* Android SDK and NDK
* Apache Ant

## Installation

To manually use Hyperloop (or to use the latest master version apart from Titanium SDK) you need to:

* Clone this repo locally
* Modify the `android/build.properties` to point to the latest Titanium SDK version and your Android SDK JARs
* In the terminal, cd to repo's `android` directory
* Run `ant` to buld the module
* Move the `android/dist/hyperloop-X.X.X.zip` file that has just been created to the root of your Titanium project. It will be automatically unzipped when the project is built
* Add the plugin and module to your tiapp.xml:
```xml
	<plugins>
		<plugin>hyperloop</plugin>
	</plugins>
	<modules>
		<module platform="android">hyperloop</module>
		<module platform="iphone">hyperloop</module>
	</modules>
```
* Do some cool stuff!

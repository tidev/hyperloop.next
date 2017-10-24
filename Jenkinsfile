@Library('pipeline-library')
import com.axway.AppcCLI;

// Tweak these if you want to test against different nodejs or environment
def nodeVersion = '6.9.5'
def platformEnvironment = 'prod' // 'preprod'
def credentialsId = '895d8db1-87c2-4d96-a786-349c2ed2c04a' // preprod = '65f9aaaf-cfef-4f22-a8aa-b1fb0d934b64'
def sdkVersion = '6.2.0.GA'
def androidAPILevel = '26'

// gets assigned once we read the package.json file
def packageVersion = ''

def appc = new AppcCLI(steps)
appc.environment = 'prod'

node {
	stage('Checkout') {
		// checkout scm
		// Hack for JENKINS-37658 - see https://support.cloudbees.com/hc/en-us/articles/226122247-How-to-Customize-Checkout-for-Pipeline-Multibranch
		checkout([
			$class: 'GitSCM',
			branches: scm.branches,
			extensions: scm.extensions + [[$class: 'CleanBeforeCheckout']],
			userRemoteConfigs: scm.userRemoteConfigs
		])
	} // stage

	stage('Setup') {
		def packageJSON = jsonParse(readFile('package.json'))
		packageVersion = packageJSON['version']

		nodejs(nodeJSInstallationName: "node ${nodeVersion}") {
			sh 'npm i -g npm' // install latest npm
			// Now do top-level linting
			sh 'npm install'
			sh 'npm test'

			// Sub-builds assume they can copy common folders from top-level like documentation, LICENSE, etc
			// So we need to stash it all, not per-platform directories
			stash includes: '**/*', name: 'source'
		} // nodejs
	} // stage
} // node

stage('Build') {
	parallel(
		'android': {
			node('android-sdk && android-ndk && osx') { // FIXME Support linux or windows!
				unstash 'source'

				nodejs(nodeJSInstallationName: "node ${nodeVersion}") {
					appc.install()
					def activeSDKPath = appc.installAndSelectSDK(sdkVersion)

					echo 'Building Android module...'
					sh 'mkdir -p assets' // node-based android build fails if this doesn't exist

					// We have to hack to make sure we pick up correct ANDROID_SDK/NDK values from the node that's currently running this section of the build.
					def androidSDK = env.ANDROID_SDK // default to what's in env (may have come from jenkins env vars set on initial node)
					def androidNDK = env.ANDROID_NDK
					withEnv(['ANDROID_SDK=', 'ANDROID_NDK=']) {
						try {
							androidSDK = sh(returnStdout: true, script: 'printenv ANDROID_SDK')
						} catch (e) {
							// squash, env var not set at OS-level
						}
						try {
							androidNDK = sh(returnStdout: true, script: 'printenv ANDROID_NDK')
						} catch (e) {
							// squash, env var not set at OS-level
						}

						dir('android') {
							sh "sed -i.bak 's/VERSION/${packageVersion}/g' ./manifest"
							writeFile file: 'build.properties', text: """
titanium.platform=${activeSDKPath}/android
android.platform=${androidSDK}/platforms/android-${androidAPILevel}
google.apis=${androidSDK}/add-ons/addon-google_apis-google-${androidAPILevel}
"""
							// FIXME We should have a module clean command!
							// manually clean
							sh 'rm -rf build/'
							sh 'rm -rf dist/'
							sh 'rm -rf libs/'
							appc.loggedIn {
								// Even setting config needs login, ugh
								sh "appc ti config android.sdkPath ${androidSDK}"
								sh "appc ti config android.ndkPath ${androidNDK}"
								sh 'appc run -p android --build-only'
							} // appc.loggedIn
							// This doesn't package up the Android hyperloop plugin hook!
							// We need to unzip, and hack it in!
							dir('dist') {
								sh 'rm -f hyperloop-android.jar'
								sh "unzip hyperloop-android-${packageVersion}.zip"
								sh "rm -rf hyperloop-android-${packageVersion}.zip"
								sh 'cp -R ../plugins plugins/' // Copy in plugins folder from android
								sh 'rm -rf plugins/hyperloop/test' // wipe android hook tests
								// copy top-level plugin hook
								sh 'cp ../../plugins/hyperloop.js plugins/hyperloop/hooks/hyperloop.js'
								dir ('plugins/hyperloop/hooks/android') { // install the android-specific hook npm dependencies
									sh 'npm install --production'
									sh 'rm -rf package-lock.json' // Now remove the package-lock.json!
									sh 'rm -rf test' // remove the test directory
								}
								sh 'rm -rf plugins/hyperloop/hooks/android@tmp' // remove this bogus dir if it exists
								// Remove docs and examples
								sh "rm -rf modules/android/hyperloop/${packageVersion}/example"
								sh "rm -rf modules/android/hyperloop/${packageVersion}/documentation"
								// Now zip it back up
								sh "zip -r hyperloop-android-${packageVersion}.zip ."
							}
							stash includes: 'dist/hyperloop-android-*.zip', name: 'android-zip'
						} // dir
					} // withEnv
				} // nodejs
			} // node
		},
		'iOS': {
			node('osx && xcode') {
				unstash 'source'

				nodejs(nodeJSInstallationName: "node ${nodeVersion}") {
					appc.install()
					appc.installAndSelectSDK(sdkVersion)

					echo 'Building iOS module...'
					dir('iphone') {
						sh "sed -i.bak 's/VERSION/${packageVersion}/g' ./manifest"

						// Check if xcpretty gem is installed
						// if (sh(returnStatus: true, script: 'which xcpretty') != 0) {
						// 	// FIXME Typically need sudo rights to do this!
						// 	sh 'gem install xcpretty'
						// }

						sh 'rm -rf build'
						sh './build.sh' // TODO Move the logic into this and use the appc cli to build!

						// sh "mkdir -p build/zip/modules/iphone/hyperloop/${packageVersion}"
						// sh 'mkdir -p build/zip/plugins/hyperloop/hooks/ios'
						// sh 'mkdir -p build/zip/plugins/hyperloop/node_modules/hyperloop-metabase'
						// sh "cp manifest module.xcconfig build/zip/modules/iphone/hyperloop/${packageVersion}"
						// 	// Building for TiCore
						// 	echo "Building for TiCore ..."
						// 	sh 'appc ti build --build-only'
						// 	// Keep the libhyperloop.a and rename it to libhyperloop-ticore.a
						// 	sh "cp build/libhyperloop.a build/zip/modules/iphone/hyperloop/${packageVersion}/libhyperloop-ticore.a"
						//
						// 	// Building for JSCore
						// 	echo "Building for JSCore ..."
						// 	sh "sed -i.bak 's/TIMODULE=1/TIMODULE=1 USE_JSCORE_FRAMEWORK=1/g' ./titanium.xcconfig"
						// 	sh 'appc ti build --build-only'
						// 	// Keep the libhyperloop.a and rename it to libhyperloop-jscore.a
						// 	sh "cp build/libhyperloop.a build/zip/modules/iphone/hyperloop/${packageVersion}/libhyperloop-jscore.a"
						//
						// 	// Add a fake libhyperloop.a file
						// 	sh "echo 1 > build/zip/modules/iphone/hyperloop/${packageVersion}/libhyperloop.a"

						// THEN we need to combine all the plugins stuff!
						// And build and package the metabase shit!
						stash includes: "hyperloop-iphone-${packageVersion}.zip", name: 'iphone-zip'
					} // dir
				} // nodejs
			} // node
		},
		'windows': {
			node('windows && (vs2015 || vs2017)') {
				ws('hl-windows') { // change workspace name to be shorter, avoid path too long errors!
					unstash 'source'

					nodejs(nodeJSInstallationName: "node ${nodeVersion}") {
						appc.install()
						def activeSDKPath = appc.installAndSelectSDK(sdkVersion)

						echo 'Building Windows module...'
						// FIXME How the hell is Windows OK with these shell commands?
						dir('windows') {
							sh "sed -i.bak 's/VERSION/${packageVersion}/g' ./manifest"
							// FIXME We should have a module clean command!
							// manually clean
							sh 'rm -rf build/'
							sh 'rm -rf dist/'
							sh 'rm -rf Windows10.ARM/'
							sh 'rm -rf Windows10.Win32/'
							sh 'rm -rf WindowsPhone.ARM/'
							sh 'rm -rf WindowsPhone.Win32/'
							sh 'rm -rf WindowsStore.Win32/'
							sh 'rm -f CMakeLists.txt'
							sh 'rm -f hyperloop-windows-*.zip'
							appc.loggedIn {
								sh 'appc run -p windows --build-only'
							} // appc.loggedIn
							// This doesn't package up the Windows hyperloop plugin hook!
							// We need to unzip, and hack it in!
							sh 'rm -rf zip/'
							sh 'mkdir zip/'
							sh "mv hyperloop-windows-${packageVersion}.zip zip/hyperloop-windows-${packageVersion}.zip"
							dir('zip') {
								sh "unzip hyperloop-windows-${packageVersion}.zip"
								sh "rm -rf hyperloop-windows-${packageVersion}.zip"
								sh 'mkdir -p plugins/hyperloop/hooks'
								sh 'cp -R ../sdk_plugins/windows plugins/hyperloop/hooks/' // Copy in plugins folder from windows
								// copy top-level plugin hook
								sh 'cp ../../plugins/hyperloop.js plugins/hyperloop/hooks/hyperloop.js'
								// Remove docs and examples
								sh "rm -rf modules/windows/hyperloop/${packageVersion}/example"
								sh "rm -rf modules/windows/hyperloop/${packageVersion}/documentation"
								// Now zip it back up
								sh "zip -r hyperloop-windows-${packageVersion}.zip ."
							}
							stash includes: 'zip/hyperloop-windows-*.zip', name: 'windows-zip'
						} // dir
					} // nodejs
					deleteDir() // wipe workspace
				} // ws
			} // node
		},
		failFast: true
	)
}

stage('Package') {
	node('osx || linux') {
		sh 'rm -rf dist'
		sh 'mkdir -p dist'

		// Copy the built module/plugin for iOS under a new dist dir
		unstash 'iphone-zip'
		sh "mv hyperloop-iphone-${packageVersion}.zip dist/"

		unstash 'windows-zip'
		sh "mv zip/hyperloop-windows-${packageVersion}.zip dist/"

		unstash 'android-zip'

		echo 'Creating combined zip with iOS, Windows, and Android ...'
		dir('dist') {
			sh "unzip hyperloop-android-${packageVersion}.zip"
			sh "rm -f hyperloop-android-${packageVersion}.zip"
			sh "unzip -o hyperloop-iphone-${packageVersion}.zip"
			sh "rm -f hyperloop-iphone-${packageVersion}.zip"
			sh "unzip -o hyperloop-windows-${packageVersion}.zip"
			sh "rm -f hyperloop-windows-${packageVersion}.zip"

			// Here we extract and force the version of the plugin into the folder structure
			sh 'mkdir -p temp'
			sh 'cp -R plugins/hyperloop/* temp'
			sh 'rm -rf plugins'
			sh "mkdir -p plugins/hyperloop/${packageVersion}"
			sh "cp -R temp/* plugins/hyperloop/${packageVersion}"
			sh 'rm -rf temp'

			sh "zip -q -r hyperloop-${packageVersion}.zip * --exclude=*test* --exclude=*.DS_Store* --exclude=*.git* --exclude *.travis.yml*  --exclude *.gitignore*  --exclude *.npmignore* --exclude *CHANGELOG* --exclude *.jshintrc*"
			sh 'rm -rf modules'
			sh 'rm -rf plugins'
		}
		archiveArtifacts "dist/hyperloop-${packageVersion}.zip"
	}
}

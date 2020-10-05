@Library('pipeline-library')
import com.axway.TitaniumCLI;
import com.axway.AppcCLI;

// Tweak these if you want to test against different nodejs or environment
def nodeVersion = '10.17.0'
def sdkVersion = '9.2.1.v20201002104158'
def androidAPILevel = '26'

// gets assigned once we read the package.json file
def packageVersion = ''

def titanium = new TitaniumCLI(steps)

node {
	try {
		stage('Lint') {
			checkout scm
			def packageJSON = jsonParse(readFile('package.json'))
			packageVersion = packageJSON['version']

			nodejs(nodeJSInstallationName: "node ${nodeVersion}") {
				ensureNPM()
				// Now do top-level linting
				command 'npm ci'
				command 'npm test'
			} // nodejs
		} // stage
	} finally {
		step([$class: 'WsCleanup'])
	}
} // node

stage('Build') {
	parallel(
		'android': {
			node('android-sdk && android-ndk && osx') { // FIXME Support linux or windows!
				try {
					checkout scm

					nodejs(nodeJSInstallationName: "node ${nodeVersion}") {
						ensureNPM()
						titanium.install()
						def activeSDKPath = titanium.installAndSelectSDK(sdkVersion)

						echo 'Building Android module...'
						sh 'mkdir -p assets' // node-based android build fails if this doesn't exist

						// We have to hack to make sure we pick up correct ANDROID_SDK/NDK values from the node that's currently running this section of the build.
						def androidSDK = env.ANDROID_SDK // default to what's in env (may have come from jenkins env vars set on initial node)
						def androidNDK = env.ANDROID_NDK_R12B
						withEnv(['ANDROID_SDK=', 'ANDROID_NDK=']) {
							try {
								androidSDK = sh(returnStdout: true, script: 'printenv ANDROID_SDK')
							} catch (e) {
								// squash, env var not set at OS-level
							}
							try {
								androidNDK = sh(returnStdout: true, script: 'printenv ANDROID_NDK_R12B')
							} catch (e) {
								// squash, env var not set at OS-level
							}

							dir('android') {
								sh "sed -i.bak 's/VERSION/${packageVersion}/g' ./manifest"
								sh "sed -i.bak 's/0.0.0-PLACEHOLDER/${packageVersion}/g' ./hooks/package.json"

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

								// Run hook tests and then prune to production deps
								dir('hooks') {
									sh 'npm ci'
									sh 'npm test'
									sh 'rm -rf node_modules'
									sh 'npm ci --production'
								}

								sh "ti config android.sdkPath ${androidSDK}"
								sh "ti config android.ndkPath ${androidNDK}"
								sh 'ti build -p android --build-only'

								// Clean dist zip
								dir('dist') {
									sh 'rm -f hyperloop-android.jar'
									sh "unzip hyperloop-android-${packageVersion}.zip"
									sh "rm -rf hyperloop-android-${packageVersion}.zip"

									dir ("modules/android/hyperloop/${packageVersion}/hooks") {
										sh 'rm -rf coverage'
										sh 'rm -f junit_report.xml'
										sh 'rm -f package.json.bak'
										sh 'rm -f package-lock.json'
										sh 'rm -rf test'
									}

									// Remove bogus dir created by previous dir operation
									sh "rm -rf modules/android/hyperloop/${packageVersion}/hooks@tmp"

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
				} finally {
					step([$class: 'WsCleanup'])
				}
			} // node
		},
		'iOS': {
			node('osx && xcode-12') {
				try {
					checkout scm

					nodejs(nodeJSInstallationName: "node ${nodeVersion}") {
						ensureNPM()
						titanium.install()
						titanium.installAndSelectSDK(sdkVersion)

						echo 'Building iOS module...'
						dir('iphone') {
							sh "sed -i.bak 's/VERSION/${packageVersion}/g' ./manifest"
							sh "sed -i.bak 's/0.0.0-PLACEHOLDER/${packageVersion}/g' ./hooks/package.json"

							// Check if xcpretty gem is installed
							// if (sh(returnStatus: true, script: 'which xcpretty') != 0) {
							// 	// FIXME Typically need sudo rights to do this!
							// 	sh 'gem install xcpretty'
							// }

							sh 'rm -rf build'
							sh './build.sh' // TODO Move the logic into this and use the ti cli to build!

							// THEN we need to combine all the plugins stuff!
							// And build and package the metabase sh*t!
							stash includes: "hyperloop-iphone-${packageVersion}.zip", name: 'iphone-zip'
						} // dir
					} // nodejs
				} finally {
					step([$class: 'WsCleanup'])
				}
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

		unstash 'android-zip'

		echo 'Creating combined zip with iOS and Android ...'
		dir('dist') {
			sh "unzip hyperloop-android-${packageVersion}.zip"
			sh "rm -f hyperloop-android-${packageVersion}.zip"
			sh "unzip -o hyperloop-iphone-${packageVersion}.zip"
			sh "rm -f hyperloop-iphone-${packageVersion}.zip"
			sh "zip -q -r hyperloop-${packageVersion}.zip * --exclude=*test* --exclude=*.DS_Store* --exclude=*.git* --exclude *.travis.yml*  --exclude *.gitignore*  --exclude *.npmignore* --exclude *CHANGELOG* --exclude *.jshintrc*"
			sh 'rm -rf modules'
		}
		archiveArtifacts "dist/hyperloop-${packageVersion}.zip"
	}
}

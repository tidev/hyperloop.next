@NonCPS
def jsonParse(def json) {
	new groovy.json.JsonSlurperClassic().parseText(json)
}
// TWeak these if you want to test against different nodejs or environment
def nodeVersion = '4.7.3'
def platformEnvironment = 'prod' // 'preprod'
def credentialsId = '895d8db1-87c2-4d96-a786-349c2ed2c04a' // preprod = '65f9aaaf-cfef-4f22-a8aa-b1fb0d934b64'
def sdkVersion = '6.0.1.GA'

// gets assigned once we read the package.json file
def packageVersion = ''

node {
	stage('Checkout') {
		checkout scm
	} // stage

	stage('Setup') {
		def packageJSON = jsonParse(readFile('package.json'))
		packageVersion = packageJSON['version']
		nodejs(nodeJSInstallationName: "node ${nodeVersion}") {
			sh 'npm install'
		}
		// Sub-builds assume they can copy common folders from top-level like documentation, LICENSE.md, etc
		// So we need to stash it all, not per-platform directories
		stash includes: '**/*', name: 'source'
	} // stage
} // node

stage('Build') {

	parallel(
		'android': {
			node('android-sdk && android-ndk && ant') {
				unstash 'source'

				nodejs(nodeJSInstallationName: "node ${nodeVersion}") {
					sh 'npm install -g appcelerator'
					sh 'appc logout'
					sh "appc config set defaultEnvironment ${platformEnvironment}"
					sh 'appc use latest'

					withCredentials([usernamePassword(credentialsId: credentialsId, passwordVariable: 'PASS', usernameVariable: 'USER')]) {
						sh 'appc login --username "$USER" --password "$PASS" -l trace'
					}
					sh "appc ti sdk install ${sdkVersion} -d"
				}

				echo 'Building Android module...'
				dir('android') {
					sh "sed -i.bak 's/VERSION/${packageVersion}/g' ./manifest"
					// FIXME: Need to ensure that Android SDK level 23 is installed
					// FIXME: Need to ensure that Android NDK r11c is installed
					def antHome = tool(name: 'Ant 1.9.2', type: 'ant')
					withEnv(["PATH+ANT=${antHome}/bin"]) {
						sh 'ant clean'
						sh 'ant test dist'
					}
					stash includes: 'android/dist/hyperloop-android-*.zip', name: 'android-zip'
				}
			}
		},
		'iOS': {
			node('osx && xcode') {
				unstash 'source'

				nodejs(nodeJSInstallationName: "node ${nodeVersion}") {
					sh 'npm install -g appcelerator'
					sh 'appc logout'
					sh "appc config set defaultEnvironment ${platformEnvironment}"
					sh 'appc use latest'

					withCredentials([usernamePassword(credentialsId: credentialsId, passwordVariable: 'PASS', usernameVariable: 'USER')]) {
						sh 'appc login --username "$USER" --password "$PASS" -l trace'
					}
					sh "appc ti sdk install ${sdkVersion} -d"
				}

				echo 'Building iOS module...'
				dir('iphone') {
					sh "sed -i.bak 's/VERSION/${packageVersion}/g' ./manifest"

					dir('iphone') {
						// Check if xcpretty gem is installed
						if (sh(returnStatus: true, script: 'which xcpretty') != 0) {
							// FIXME Typically need sudo rights to do this!
							sh 'gem install xcpretty'
						}
						sh 'rm -rf build'
						nodejs(nodeJSInstallationName: "node ${nodeVersion}") {
							sh './build.sh' // FIXME Can we move the logic into this file?
						}
					}
					stash includes: 'iphone/build/zip/', name: 'iphone-zip'
				}
			}
		},
		failFast: true
	)
}

stage('Package') {
	node('osx || linux') {
		sh 'rm -rf dist'

		// Copy the built module/plugin for iOS under a new dist dir
		unstash 'iphone-zip'
		sh 'mv iphone/build/zip/ dist/'

		unstash 'android-zip'
		sh "mv hyperloop-android-${packageVersion}.zip dist/"

		echo 'Creating combined zip with iOS and Android ...'
		dir('dist') {
			sh "unzip hyperloop-android-${packageVersion}.zip"

			// Here we extract and force the version of the plugin into the folder structure
			sh 'mkdir -p temp'
			sh 'cp -R plugins/hyperloop/* temp'
			sh 'rm -rf plugins'
			sh "mkdir -p plugins/hyperloop/${packageVersion}"
			sh "cp -R temp/* plugins/hyperloop/${packageVersion}"
			sh 'rm -rf temp'

			sh "zip -q -r hyperloop-${packageVersion}.zip *"
			sh 'rm -rf modules'
			sh 'rm -rf plugins'
		}
		archiveArtifacts "dist/hyperloop--${packageVersion}.zip"
	}
}

properties(buildDiscarder(logRotator(numToKeepStr: '15')))

node('git && android-sdk && android-ndk && node-4 && xcversion && zip && unzip && npm && xcode') {
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

	stage('Build') {
		dir('tools') {
			sh 'build.sh'
		}
		archiveArtifacts 'dist/*.zip'
		junit '**/build/reports/junit.xml'
	} // stage
} // node

module.exports = function (grunt) {

	// Project configuration.
	grunt.initConfig({
		appcJs: {
			src: [ 'Gruntfile.js', 'android/plugins/hyperloop/hooks/**/*.js', 'iphone/plugin/*.js', 'plugins/**/*.js' ]
		},
		// mocha_istanbul: {
		// 	coverage: {
		// 		src: 'test',
		// 		options: {
		// 			ignoreLeaks: false,
		// 			check: {
		// 				statements: 80,
		// 				branches: 80,
		// 				functions: 80,
		// 				lines: 80
		// 			},
		// 			reporter: 'mocha-jenkins-reporter',
		// 			reportFormats: [ 'lcov', 'cobertura' ]
		// 		}
		// 	}
		// }
	});

	// Load grunt plugins for modules
	// grunt.loadNpmTasks('grunt-mocha-test');
	grunt.loadNpmTasks('grunt-appc-js');
	// grunt.loadNpmTasks('grunt-contrib-clean');

	// register tasks
	grunt.registerTask('lint', [ 'appcJs' ]);
	grunt.registerTask('default', [ 'lint' ]);
};

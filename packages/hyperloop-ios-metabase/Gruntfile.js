'use strict';

module.exports = function (grunt) {

	// Project configuration.
	grunt.initConfig({
		mocha_istanbul: {
			options: {
				timeout: 30000,
				reporter: 'mocha-jenkins-reporter',
				ignoreLeaks: false,
				globals: [ 'Hyperloop', 'HyperloopObject' ],
				reportFormats: [ 'lcov', 'cobertura' ],
				check: {
					statements: 22,
					branches: 17,
					functions: 21,
					lines: 22
				}
			},
			src: [ 'test/**/*_test.js' ]
		},
		appcJs: {
			src: [
				'Gruntfile.js',
				'index.js',
				'lib/**/*.js',
				'test/**/*.js'
			]
		},
		clean: [ 'tmp' ]
	});

	// Load grunt plugins for modules
	require('load-grunt-tasks')(grunt);

	// register tasks
	grunt.registerTask('default', [ 'appcJs', 'mocha_istanbul', 'clean' ]);
};

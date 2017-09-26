'use strict';

const async = require('async'),
	EXEC_LIMIT = 10;

module.exports = function (grunt) {

	const iosSrc = [ 'iphone/**/*.h', 'iphone/**/*.m' ];

	// Project configuration.
	grunt.initConfig({
		appcJs: {
			src: [ 'Gruntfile.js', 'android/plugins/hyperloop/hooks/**/*.js', 'iphone/plugin/*.js', 'plugins/**/*.js', 'windows/plugins/hyperloop/hooks/**/*.js', 'windows/sdk_plugins/**/*.js' ]
		},
		clangFormat: {
			src: iosSrc
		},
		ios_format: {
			src: iosSrc
		},
		clean: {
			cover: [ 'coverage' ]
		},
		mocha_istanbul: {
			coverage: {
				src: 'android/plugins/hyperloop/test',
				options: {
					ignoreLeaks: false,
					check: {
						statements: 80,
						branches: 80,
						functions: 80,
						lines: 80
					},
					reporter: 'mocha-jenkins-reporter',
					reportFormats: [ 'lcov', 'cobertura' ]
				}
			}
		}
	});

	grunt.registerMultiTask('ios_format', 'Validates the iOS source code formatting.', function () {
		const done = this.async(),
			clangFormat = require('clang-format');

		// Iterate over all specified file groups.
		let src = [];
		this.files.forEach(function (f) {
			// Concat specified files.
			src = src.concat(f.src.filter(function (filepath) {
				// Warn on and remove invalid source files (if nonull was set).
				if (!grunt.file.exists(filepath)) {
					grunt.log.warn('Source file "' + filepath + '" not found.');
					return false;
				} else {
					return true;
				}
			}));
		});

		// Check format of the files in parallel, but limit number of simultaneous execs or we'll fail
		const errors = [];
		async.mapLimit(src, EXEC_LIMIT, function (filepath, cb) {
			let stdout = '';

			const proc = clangFormat.spawnClangFormat([ '-output-replacements-xml', filepath ], function () {}, 'pipe');
			proc.stdout.on('data', function (data) {
				stdout += data.toString();
			});
			proc.on('close', function (exit) {
				if (exit) {
					grunt.log.warn('Exit code: ' + exit);
					grunt.fail.fatal(stdout);
					cb(exit);
				}

				const modified = stdout.replace(/\r?\n/g, '');
				if (modified !== '<?xml version=\'1.0\'?><replacements xml:space=\'preserve\' incomplete_format=\'false\'></replacements>') {
					// Record failure, because formatting is bad.
					// TODO Get the correctly formatted source? Give more details on the bad sections?
					errors.push(new Error('Formatting incorrect on "' + filepath + '", proposed changes: ' + stdout));
				}
				// grunt.log.ok(filepath);
				cb();
			});
		}, function () {
			if (errors.length > 0) {
				grunt.fail.fatal(errors.join('\n'));
				return done(new Error(errors.join('\n')));
			}
			done();
		});
	});

	// Load grunt plugins for modules
	grunt.loadNpmTasks('grunt-mocha-istanbul');
	grunt.loadNpmTasks('grunt-appc-js');
	grunt.loadNpmTasks('grunt-clang-format');
	grunt.loadNpmTasks('grunt-contrib-clean');

	// register tasks
	grunt.registerTask('test', [ 'clean:cover', 'mocha_istanbul:coverage' ]);
	grunt.registerTask('lint', [ 'appcJs', 'ios_format' ]);
	grunt.registerTask('format', [ 'clangFormat' ]);
	grunt.registerTask('default', [ 'lint', 'test' ]);
};

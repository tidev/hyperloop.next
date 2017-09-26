/**
 * Android metabase generation
 */
'use strict';
const _ = require('lodash'),
	fs = require('fs'),
	path = require('path'),
	spawn = require('child_process').spawn, // eslint-disable-line security/detect-child-process
	crypto = require('crypto'),
	zlib = require('zlib'),
	chalk = require('chalk'),
	util = require('./util');

/**
 * Compiles the Java class that introspects APIs and generates a metabase if necessary.
 * On completion, the callback will be called.
 *
 * @param {String}   outdir directory for the generated .class file.
 * @param {String}   cp classpath to compile with. Typically points to any 3rd-party libs we require to build.
 * @param {Function} callback Executed upon completion or error
 *
 * @returns {void}
 **/
function compileIfNecessary(outdir, cp, callback) {
	const classFile = path.join(outdir, 'JavaMetabaseGenerator.class'),
		shaFile = path.join(outdir, 'JavaMetabaseGenerator.sha'),
		srcFile = path.join(__dirname, 'src', 'JavaMetabaseGenerator.java'),
		newSHA = crypto.createHash('sha1').update(fs.readFileSync(srcFile, 'utf8')).digest('hex');

	if (fs.existsSync(classFile) && fs.existsSync(shaFile)) {
		const oldSHA = fs.readFileSync(shaFile, 'utf8');
		if (oldSHA === newSHA) {
			// don't re-compile
			return callback(null);
		}
		// delete old sha/class file?
	}

	// Compile
	const p = spawn('javac', [ '-source', '1.6', '-target', '1.6', '-cp', cp, srcFile, '-d', outdir ], { env:process.env });
	let err = '';

	p.stderr.on('data', function (buf) {
		err += buf.toString();
	});
	p.on('close', function (exitCode) {
		if (exitCode === 0) {
			// save new SHA
			fs.writeFile(shaFile, newSHA, function () {
				return callback(null);
			});
		} else {
			callback(err);
		}
	});
}

/**
 * Generate the metabase as string containing JSON.
 * On completion, the callback will be called with the resulting string holding JSON output.
 *
 * @param {String}   classPath classpath to compile with. This should point at the JAR files containing the APIs we want to generate a metabase for.
 * @param {Object}   [opts={}] Options for metabase creation
 * @param {String}   [opts.dest] - where to place the generated Java class file.
 * @param {String}   [opts.cacheDir] - where to place the cache files. Used as fallback for Java class output location if opts.dest not specified.
 * @param {Function} callback Executed upon completion or error
 *
 * @returns {void}
 **/
function generate(classPath, opts, callback) {
	classPath = typeof(classPath) === 'string' ? [ classPath ] : classPath;

	const dest = opts.dest || opts.cacheDir || 'build',
		cp = [ path.join(__dirname, 'lib', 'bcel-5.2.jar'), path.join(__dirname, 'lib', 'json.jar'), dest ];

	compileIfNecessary(dest, cp.join(path.delimiter), function (err) {
		if (err) {
			return callback(err);
		}
		// Add the 3rd-party libs to classpath when running
		const p = spawn('java', [ '-Xmx1G', '-classpath', cp.concat(classPath).join(path.delimiter), 'JavaMetabaseGenerator' ], { env:process.env });
		let out = '';
		let stderr = '';
		p.stdout.on('data', function (buf) {
			out += buf.toString();
		});

		p.stderr.on('data', function (buf) {
			stderr += buf.toString();
		});

		p.on('close', function (exitCode) {
			callback(exitCode === 0 ? null : stderr, out);
		});
	});
}

/**
 * Generate the metabase as JSON.
 * On completion, the callback will be called with the parsed JSON output (a JSObject).
 *
 * @param {String}   classPath classpath to compile with. This should point at the JAR files containing the APIs we want to generate a metabase for.
 * @param {Object}   [opts={}] Options for metabase creation
 * @param {String}   [opts.dest] - where to place the generated Java class file.
 * @param {String}   [opts.cacheDir] - where to place the cache files. Used as fallback for Java class output location if opts.dest not specified.
 * @param {Function} callback Executed upon completion or error
 *
 * @returns {void}
 **/
function generateJSON(classPath, opts, callback) {
	generate(classPath, opts, function (err, buffer) {
		if (err) {
			return callback(err);
		}
		return callback(null, JSON.parse(buffer));
	});
}

/**
 * Loads the metabase either from the cache, or creates a new one.
 * On success, the callback will be executed with a JSON representation
 *
 * @param {String}   classpathToAdd classpath to run through. this may be null.
 * @param {Object}   [opts={}] Options for metabase creation
 * @param {Boolean}  [opts.force] - Force recreation of metabase, i.e. skip any existing cached metabase
 * @param {String}   [opts.isTest] - flag to note that this is being executed through tests to avoid messing with "real" cached files. Defaults to 'not-test'
 * @param {String}   [opts.cacheDir] - where to place the cached files. Defaults to tmpdir.
 * @param {String}   [opts.dest] - where to place the generated Java class file. opts.cacheDir is used as fallback if specified. Otherwise defaults to 'build'
 * @param {Function} callback Executed upon completion or error
 *
 * @returns {void}
 */
function loadMetabase(classpathToAdd, opts, callback) {
	// validate arguments
	callback = arguments[arguments.length - 1] || function () {};
	if (_.isFunction(opts) || !opts) {
		opts = {};
	} else if (!_.isObject(opts)) {
		throw new TypeError('Bad arguments');
	}

	// set defaults
	opts = _.defaults(opts, {
		isTest: (process.env['HYPERLOOP_TEST'] ? 'test' : 'not-test'),
		cacheDir: process.env.TMPDIR || process.env.TEMP || '/tmp'
	});

	const parsedChecksum = calculateCacheToken(classpathToAdd, opts);
	opts.cacheFile = path.join(opts.cacheDir, 'hyperloop_' + opts.platform + '_metabase.' + parsedChecksum + '.json.gz');

	const cacheFile = opts.cacheFile;

	// see if we have a cache file
	if (cacheFile && fs.existsSync(cacheFile) && !opts.force) {
		return loadCache(cacheFile, callback);
	} else {
		// base timestamp
		const lastTime = Date.now();

		util.logger.info(chalk.green.bold('Generating system metabase'));
		// spinner.start(
		//	'Generating system metabase'.green.bold,
		//	'Generating system metabase will take up to a minute (or greater) depending on your ' +
		//	'environment.' +
		//	(opts.force ? '' : 'This file will be cached and will execute faster on subsequent builds.')
		// );

		// generate a new metabase from classpath
		// first argument is for additional classpath
		generateJSON(classpathToAdd, opts, function (err, metabase) {
			if (err) {
				return callback(err);
			} else if (!metabase) {
				return callback('Failed to generate metabase');
			}

			const thisTime = Date.now();
			// spinner.stop();
			util.logger.info('Generated AST cache file at', cacheFile, 'in', timeDiff(thisTime, lastTime), 'seconds');

			zlib.gzip(JSON.stringify(metabase, null, '  '), function (err, buf) {
				fs.writeFile(cacheFile, buf, function () {
					return callback(null, metabase);
				});
			});
		});
	}
}

/**
 * Calculate cache token based on classpath (JARs we're introspecting), testing
 * flag, and contents of the metabase generator Java file.
 *
 * @param {Array|string} classPath Java CLASSPATH passed to the compiler
 * @param {Object} opts Options object
 * @return {string} The calculated cache token
 */
function calculateCacheToken(classPath, opts) {
	if (typeof classPath === 'string') {
		classPath = classPath.split(path.delimiter);
	}
	const classPathContentHashes = {};
	classPath.forEach(function (jarPathAndFilename) {
		if (!fs.existsSync(jarPathAndFilename)) {
			throw new Error('Invalid CLASSPATH specified, file ' + jarPathAndFilename + ' does not exist.');
		}
		const hash = crypto.createHash('sha1').update(fs.readFileSync(jarPathAndFilename).toString()).digest('hex');
		classPathContentHashes[jarPathAndFilename] = hash;
	});
	return crypto.createHash('sha1').update(
		JSON.stringify(classPathContentHashes)
		+ opts.isTest
		+ fs.readFileSync(path.join(__dirname, 'src', 'JavaMetabaseGenerator.java'), 'utf8')
	).digest('hex');
}

/**
 * Load the metabase from a cache file
 *
 * @param {String} cacheFile The location of the cached metabase
 * @param {Function} callback Executed upon completion or error
 *
 * @returns {void}
 */
function loadCache(cacheFile, callback) {
	util.logger.info('Using system metabase cache file at', chalk.yellow(cacheFile));
	try {
		fs.readFile(cacheFile, function (err, buf) {
			if (/\.gz$/.test(cacheFile)) {
				zlib.gunzip(buf, function (err, buf) {
					return callback(null, JSON.parse(String(buf)));
				});
			} else {
				return callback(null, JSON.parse(String(buf)));
			}
		});
	} catch (E) {
		return callback(E);
	}
}

function timeDiff(thisTime, lastTime) {
	return ((thisTime - lastTime) / 1000).toFixed(3);
}

// module interface
exports.loadMetabase = loadMetabase;

// standalone metabase generator
if (!module.parent) {
	const classpathToAdd = process.argv[2] ? process.argv[2] : null;
	loadMetabase(classpathToAdd, { platform:'android-10', force:true }, function (e, data) {
		if (e) {
			util.logger.error(e);
		} else {
			util.logger.info(JSON.stringify(data, null, 2));
		}
	});
}

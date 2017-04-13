/**
 * Hyperloop ®
 * Copyright (c) 2015-2016 by Appcelerator, Inc.
 * All Rights Reserved. This library contains intellectual
 * property protected by patents and/or patents pending.
 */
'use strict';

/** The plugin's identifier */
exports.id = 'hyperloop';

/** The Titanium CLI version that this hook is compatible with */
exports.cliVersion = '>=3.2';

(function () {
	var path = require('path'),
		findit = require('findit'),
		fs = require('fs'),
		crypto = require('crypto'),
		chalk = require('chalk'),
		wrench = require('wrench'),
		appc = require('node-appc'),
		DOMParser = require('xmldom').DOMParser,
		async = require('async'),
		metabase = require(path.join(__dirname, 'metabase'));

	// set this to enforce a minimum Titanium SDK
	var TI_MIN = '6.0.0';

	/*
	 State.
	 */
	var config,
		cli,
		logger,
		HL = chalk.magenta.inverse('Hyperloop'),
		resourcesDir,
		filesDir,
		hyperloopBuildDir, // where we generate the JS wrappers during build time
		hyperloopResources, // Where we copy the JS wrappers we need for runtime
		afs,
		references = {},
		files = {},
		jars = [],
		aars = {},
		cleanup = [],
		requireRegex = /require\s*\(\s*[\\"']+([\w_\/-\\.\\*]+)[\\"']+\s*\)/ig;

	/*
	 Config.
	 */
	function HyperloopAndroidBuilder (_logger, _config, _cli, appc, hyperloopConfig, builder) {
		this.logger = _logger;
		this.config = _config;
		this.cli = _cli;
		this.appc = appc;
		this.cfg = hyperloopConfig;
		this.builder = builder;
	}

	module.exports = HyperloopAndroidBuilder;

	/**
	 * Generates the sha1 for a file's contents
	 * @param  {String}   file Path to the file
	 * @param  {Function} next callback function. Receives a String result
	 */
	function sha1(file, next) {
		var hash = crypto.createHash('sha1'),
			stream = fs.createReadStream(file);

		stream.on('data', function (data) {
			hash.update(data, 'utf8')
		});

		stream.on('error', function (e) {
			return next(e);
		})

		stream.on('end', function () {
			return next(null, hash.digest('hex'));
		})
	}

	HyperloopAndroidBuilder.prototype.init = function (next) {
		var builder = this.builder;

		config = this.config;
		cli = this.cli;
		logger = this.logger;

		afs = appc.fs;

		// Verify minimum SDK version
		if (!appc.version.satisfies(cli.sdk.manifest.version, '>=' + TI_MIN)) {
			logger.error('You cannot use the Hyperloop compiler with a version of Titanium older than ' + TI_MIN);
			logger.error('Set the value of <sdk-version> to a newer version in tiapp.xml.');
			logger.error('For example:');
			logger.error('	<sdk-version>' + TI_MIN + '.GA</sdk-version>');
			process.exit(1);
		}

		resourcesDir = path.join(builder.projectDir, 'Resources');
		hyperloopResources = path.join(resourcesDir, 'android', 'hyperloop');

		var buildDir = path.join(builder.projectDir, 'build');
		var buildPlatform = path.join(buildDir, 'platform');
		if (!afs.exists(buildDir)) {
			fs.mkdirSync(buildDir);
		}
		else if (afs.exists(buildPlatform)) {
			wrench.rmdirSyncRecursive(buildPlatform);
		}
		if (!afs.exists(resourcesDir)) {
			fs.mkdirSync(resourcesDir);
		}
		// Wipe hyperloop resources each time, we will re-generate
		if (afs.exists(hyperloopResources)) {
			wrench.rmdirSyncRecursive(hyperloopResources);
		}

		// create a temporary hyperloop directory
		hyperloopBuildDir = path.join(buildDir, 'hyperloop', 'android');
		if (!afs.exists(hyperloopBuildDir)) {
			wrench.mkdirSyncRecursive(hyperloopBuildDir);
		}

		// check to make sure the hyperloop module is actually configured
		var moduleFound = builder.modules.map(function (i) {
			if (i.id === 'hyperloop') { return i; };
		}).filter(function (a) { return !!a; });

		// check that it was found
		if (!moduleFound.length) {
			logger.error('You cannot use the Hyperloop compiler without configuring the module.');
			logger.error('Add the following to your tiapp.xml <modules> section:');
			var pkg = JSON.parse(path.join(__dirname, '../../package.json'));
			logger.error('');
			logger.error('	<module version="' + pkg.version + '">hyperloop</module>');
			logger.warn('');
			process.exit(1);
		}

		// check for the run-on-main-thread configuration
		if (!builder.tiapp.properties['run-on-main-thread']) {
			logger.error('You cannot use the Hyperloop compiler without configuring Android to use main thread execution.');
			logger.error('Add the following to your tiapp.xml <ti:app> section:');
			logger.error('');
			logger.error('	<property name="run-on-main-thread" type="bool">true</property>');
			logger.warn('');
			process.exit(1);
		}

		cli.on('build.android.copyResource', {
			priority: 99999,
			pre: function (build, finished) {
				build.ctx._minifyJS = build.ctx.minifyJS;
				build.ctx.minifyJS = true;
				finished();
			},
			post: function (build, finished) {
				build.ctx.minifyJS = build.ctx._minifyJS;
				delete build.ctx._minifyJS;
				finished();
			}
		});

		cli.on('build.android.compileJsFile', {
			priority: 99999,
			pre: function (build, finished) {
				//TODO: switch to using the AST directly
				var fn = build.args[1];
				if (files[fn]) {
					// var ref = build.ctx._minifyJS ? 'contents' : 'original';
					build.args[0]['original'] = files[fn];
					build.args[0]['contents'] = files[fn];
					finished();
				} else {
					finished();
				}
			}
		});

		cli.on('build.android.removeFiles', {
			priority: 99999,
			post: function (build, finished) {
				logger.debug('removing temporary hyperloop files');
				cleanup.forEach(function (fn) {
					logger.debug('removing %s', fn);
					fs.unlinkSync(fn);
				});

				wrench.rmdirSyncRecursive(filesDir);
				finished();
			}
		});

		cli.on('build.android.aapt', {
			pre: function (data) {
				var args = data.args[1],
					index = args.indexOf('--extra-packages'),
					extraPackages = args[index + 1],
					packageNames = [],
					extraArgs = [];

				// Iterate over the AARs
				Object.keys(aars).forEach(function (key) {
					var packageName = aars[key];
					packageNames.push(packageName);
					extraArgs.push('-S');
					extraArgs.push(path.join(hyperloopBuildDir, key, 'res'));
				});
				if (packageNames.length > 0) {
					data.args[1][index + 1] = extraPackages.concat(':' + packageNames.join(':'));
					data.args[1] = data.args[1].concat(extraArgs);
				}
			}
		});

		cli.on('build.android.dexer', {
			pre: function (data, finished) {
				var uniqueJars = [], // the args we're building back up, eliminating duplicate JARs
					shas = {}, // SHA1 of each JAR
					basenames = {};
				// Add hyperloop JARs
				data.args[1] = data.args[1].concat(jars.slice(1));
				// TIMOB-23697 Don't add duplicate jar entries
				// http://tools.android.com/recent/dealingwithdependenciesinandroidprojects
				async.eachSeries(data.args[1], function(jarFile, callback) {
					var basename = path.basename(jarFile),
						extension = path.extname(basename);
					// Special case for classes.jar. Assume they're from AARs and the AARs are unique
					if (extension == '.jar' && basename != 'classes.jar') {

						sha1(jarFile, function (e, hash) {
							if (e) {
								return callback(e);
							}

							// Unique SHA1
							if (!shas.hasOwnProperty(hash)) {
								// But not unique basename
								if (basenames.hasOwnProperty(basename)) {
									// But we have a base JAR name clash
									// Error out and tell user we have two JARs with the same name and different contents.
									// Ask them to manually resolve by:
									// Deleting one, or renaming one (to keep both)
									return callback('Conflicting JAR files: ' + jarFile + ', and ' + basenames[basename].path + ' have different contents. Please resolve by deleting one of them, or renaming one if you\'re certain their contents aren\'t duplicates.');
								}
								// Unique jar (unique sha and basename)
								uniqueJars.push(jarFile); // Keep it in our listing...
								shas[hash] = { // record it's sha for comparison
									path: jarFile
								};
								basenames[basename] = { // record details about it in case we get a clash
									sha: hash,
									path: jarFile
								};
							} else {
								// Same SHA1 as another JAR, skip this one assuming it's a duplicate
								logger.debug('Skipping duplicate JAR: ' + jarFile + ' (duplicates ' + shas[hash].path + ')');
							}
							callback();
						});
					} else {
						// Either not a JAR, or a classes.jar that likely came from an AAR
						uniqueJars.push(jarFile);
						callback();
					}
				}, function(err) {
						if (err) {
							logger.error(err.toString());
							process.exit(1);
						}

						// Special case for android-support-v4.jar and android-support-v13.jar
						if (basenames.hasOwnProperty('android-support-v4.jar') && basenames.hasOwnProperty('android-support-v13.jar')) {
							var specialCase = [];
							// Remove v4!
							for (var i = 0; i < uniqueJars.length; i++) {
								var jarFile = uniqueJars[i],
									basename = path.basename(jarFile);
								if (basename != 'android-support-v4.jar') {
									specialCase.push(jarFile);
								}
							}
							uniqueJars = specialCase;
						}
						data.args[1] = uniqueJars;
						finished();
				});
			}
		});

		prepareBuild(builder, next);
	};

	/*
	 Hooks.
	 */

	/**
	 * Sets up the build for using the hyperloop module.
	 */
	function prepareBuild(builder, callback) {
		var metabaseJSON,
			aarFiles = [],
			sourceFolders = [resourcesDir],
			platformAndroid = path.join(cli.argv['project-dir'], 'platform', 'android');

		logger.info('Starting ' + HL + ' assembly');

		// set our CLI logger
		metabase.util.setLog(logger);

		// Need metabase for android API
		jars = [builder.androidTargetSDK.androidJar];

		async.series([
			/**
			 * Manually adds the Android Support Libraries beacuse at this point the builder
			 * hasn't loaded all the jars from our SDK core yet.
			 *
			 * @param {Function} next Callback function
			 */
			function (next) {
				var depMap = JSON.parse(fs.readFileSync(path.join(builder.platformPath, 'dependency.json')));
				var supportLibraryFilenames = depMap.libraries.appcompat;
				async.each(supportLibraryFilenames, function(libraryFilename, cb) {
					var libraryPathAndFilename = path.join(builder.platformPath, libraryFilename);
					if (afs.exists(libraryPathAndFilename)) {
						jars.push(libraryPathAndFilename);
						cb();
					} else {
						cb(new Error('Android Support Library not found at expected path ' + libraryPathAndFilename));
					}
				}, next);
			},
			// Find 3rd-party JARs and AARs
			function (next) {
				if (!afs.exists(platformAndroid)) {
					return next();
				}
				findit(platformAndroid)
					.on('file', function (file, stat) {
						if (path.extname(file) === '.jar') {
							jars.push(file);
						} else if (path.extname(file) === '.aar') {
							aarFiles.push(file);
						}
					})
					.on('end', next);
			},
			// Handle AARs
			function (next) {
				async.each(aarFiles, function (file, cb) {
					handleAAR(file, function (err, foundJars) {
						if (err) {
							return cb(err);
						}
						jars = jars.concat(foundJars);
						cb();
					});
				}, next);
			},
			// Do metabase generation from JARs
			function (next) {
				// TODO It'd be good to split out some mapping between the JAR and the types inside it.
				// Then we can know if a JAR file is "unused" and not copy/package it!
				// Kind of similar to how Jeff detects system frameworks and maps includes by framework.
				// we can map requires by containing JAR

				// Simple way may be to generate a "metabase" per-JAR
				logger.trace("Generating metabase for JARs: " + jars);
				metabase.metabase.loadMetabase(jars, {platform: 'android-' + builder.realTargetSDK}, function (err, json) {
					if (err) {
						logger.error("Failed to generated metabase: " + err);
						return next(err);
					}
					metabaseJSON = json;
					next();
				});
			},
			function (next) {
				// Need to generate the metabase first to know the full set of possible native requires as a filter when we look at requires in user's JS!
				// look for any reference to hyperloop native libraries in our JS files
				async.each(sourceFolders, function(folder, cb) {
					findit(folder)
						.on('file', function (file, stat) {
							// Only consider JS files.
							if (path.extname(file) !== '.js') {
								return;
							}
							match(file);
						})
						.on('end', function () {
							cb();
						});
					}, function(err) {
						if (err) {
							return next(err);
						}
						generateSourceFiles(copyNativeReferences);
						next();
					});
			}
		], function (err) {
			if (err) {
				return callback(err);
			}
		});

		/**
		 * handles an aar file for the build process:
		 * extracting like a zipfile
		 * copying resources around
		 *
		 * http://tools.android.com/tech-docs/new-build-system/aar-format
		 *
		 * @returns {Array[String]} paths to JAR files we extracted
		 **/
		function handleAAR(aarFile, finished) {
			var basename = path.basename(aarFile, '.aar'),
				extractedDir = path.join(hyperloopBuildDir, basename),
				foundJars = [path.join(extractedDir, 'classes.jar')];

			if (afs.exists(extractedDir)) {
				wrench.rmdirSyncRecursive(extractedDir);
			}
			// Create destination dir
			wrench.mkdirSyncRecursive(extractedDir);

			async.series([
				// Unzip aar file to destination
				function (next) {
					appc.zip.unzip(aarFile, extractedDir, {}, next);
				},
				// Then handle it's contents in parallel operations
				function (next) {
					async.parallel([
						// Extract package name from AndroidManifest.xml
						function (cb) {
							var manifestFile = path.join(extractedDir, 'AndroidManifest.xml'),
								contents = fs.readFileSync(manifestFile).toString(),
								doc = new DOMParser().parseFromString(contents, 'text/xml').documentElement;

							// Map from the folder name we're storing under to the specified package in manifest
							aars[basename] = doc.getAttribute('package');
							cb();
						},
						// copy assets
						function (cb) {
							var src = path.join(extractedDir, 'assets'),
								dest = path.join(cli.argv['project-dir'], 'build', 'android', 'assets');
							// assets is optional, skip if doesn't exist!
							if (!afs.exists(src)) {
								return cb();
							}
							afs.copyDirRecursive(src, dest, cb, {logger: logger});
						},
						// Find libs/*.jar
						function (cb) {
							var libsDir = path.join(extractedDir, 'libs');
							// directory is optional
							if (!afs.exists(libsDir)) {
								return cb();
							}
							findit(libsDir)
								.on('file', function (file, stat) {
									if (path.extname(file) !== '.jar') {
										return;
									}
									foundJars.push(file);
								})
								.on('end', cb);
						},
						// Native .so files
						function (cb) {
							var jniDir = path.join(extractedDir, 'jni'),
								buildLibs = path.join(cli.argv['project-dir'], 'build', 'android', 'libs');

							// directory is optional
							if (!afs.exists(jniDir)) {
								return cb();
							}

							findit(jniDir)
								.on('file', function (file, stat) {
									if (path.extname(file) !== '.so') {
										return;
									}
									var dest = path.join(buildLibs, path.relative(jniDir, file));
									// make dest dir
									wrench.mkdirSyncRecursive(path.dirname(dest));
									// copy .so over
									afs.copyFileSync(file, dest, {logger: logger});
								})
								.on('end', cb);
						}], next);
				}],
				function (err, results) {
					if (err) {
						logger.error('Failed to extract/handle aar zip: %s', chalk.cyan(aarFile) + '\n');
						return finished(err, foundJars);
					}
					logger.debug("Processed AAR file : " + aarFile);
					finished(null, foundJars);
				});
		}

		function copyNativeReferences () {
			var keys = Object.keys(references);
			// only if we found references, otherwise, skip
			if (keys.length) {
				wrench.mkdirSyncRecursive(hyperloopResources);
				afs.copyDirRecursive(filesDir, hyperloopResources, function (err) {
					logger.info('Finished ' + HL + ' assembly');
					if (err) {
						logger.error(err);
					}
					callback(err);
				}, {logger: logger});
			} else {
				logger.info('Finished ' + HL + ' assembly');
				callback();
			}
		}

		function match (file) {
			var matches = findHyperloopRequires(file);
			if (matches.length && matches[0].length) {
				files[file] = matches[1];
				matches[0].forEach(function (ref) {
					references[ref] = 1;
				});
				return true;
			}
			return false;
		}

		// replace the contents of a buffer
		function replaceAll (haystack, needle, replaceStr) {
			var newBuffer = haystack;
			while (1) {
				var index = newBuffer.indexOf(needle);
				if (index < 0) {
					break;
				}
				var before = newBuffer.substring(0, index),
					after = newBuffer.substring(index + needle.length);
				newBuffer = before + replaceStr + after;
			}
			return newBuffer;
		}

		// look for any require which matches our hyperloop system frameworks
		function findHyperloopRequires (file) {
			if (!afs.exists(file)) {
				return [];
			}
			else {
				var contents = fs.readFileSync(file, 'UTF-8'),
					found = [];
				logger.trace('Searching for hyperloop requires in: ' + file);
				(contents.match(requireRegex) || []).forEach(function (m) {
					var re = /require\s*\(\s*[\\"']+([\w_\/-\\.\\*]+)[\\"']+\s*\)/i.exec(m),
						className = re[1],
						lastIndex,
						validPackage = false,
						type,
						ref,
						str,
						packageRegexp = new RegExp('^' + className.replace('.', '\\.').replace('*', '[A-Z]+[a-zA-Z0-9]+') + '$');

					// Is this a Java type we found in the JARs/APIs?
					logger.trace('Checking require for: ' + className);

					// Look for requires using wildcard package names and assume all types under that namespace!
					if (className.indexOf('.*') == className.length - 2) {
						// Check that it's a valid package name and search for all the classes directly under that package!
						for (var mClass in metabaseJSON.classes) {
							if (mClass.match(packageRegexp)) {
								found.push('hyperloop/' + mClass);
								validPackage = true;
							}
						}
						if (validPackage) {
							ref = 'hyperloop/' + className.slice(0, className.length - 2); // drop the .* ending
							str = "require('" + ref + "')";
							contents = replaceAll(contents, m, str);
						}
					} else {
						// single type
						type = metabaseJSON.classes[className];
						if (!type) {
							// fallback for using dot notation to refer to nested class
							lastIndex = className.lastIndexOf('.');
							className = className.slice(0, lastIndex) + '$' + className.slice(lastIndex + 1);
							type = metabaseJSON.classes[className];
							if (!type) {
								return;
							}
						}
						// Looks like it's a Java type, so let's hack it and add it to our list!
						// replace the require to point to our generated file path
						ref = 'hyperloop/' + className;
						str = "require('" + ref + "')";
						contents = replaceAll(contents, m, str);
						found.push(ref);
					}
				});
				return [found, contents];
			}
		}

		// generate the metabase from required hyperloop files
		// and then generate the source files from that metabase
		function generateSourceFiles (next) {
			var classes = Object.keys(references);
			// no hyperloop files detected, we can stop here
			if (!classes.length) {
				logger.info('Skipping ' + HL + ' compile, no usage found ...');
				return next();
			}

			filesDir = path.join(hyperloopBuildDir, 'js');
			if (!afs.exists(filesDir)) {
				wrench.mkdirSyncRecursive(filesDir);
			}

			// drop hyperloop/ from each entry in references to get just the class names
			classes = classes.map(function(element) {
				return element.slice(10);
			});

			return metabase.generate.generateFromJSON(filesDir, metabaseJSON, classes, next);
		}
	}
})();

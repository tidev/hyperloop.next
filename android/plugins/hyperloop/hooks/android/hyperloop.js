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
		fs = require('fs-extra'),
		crypto = require('crypto'),
		chalk = require('chalk'),
		appc = require('node-appc'),
		DOMParser = require('xmldom').DOMParser,
		async = require('async'),
		metabase = require(path.join(__dirname, 'metabase'));

	// set this to enforce a minimum Titanium SDK
	var TI_MIN = '6.1.0';

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
		exclusiveJars = [],
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
			fs.removeSync(buildPlatform);
		}
		if (!afs.exists(resourcesDir)) {
			fs.mkdirSync(resourcesDir);
		}
		// Wipe hyperloop resources each time, we will re-generate
		if (afs.exists(hyperloopResources)) {
			fs.removeSync(hyperloopResources);
		}

		// create a temporary hyperloop directory
		hyperloopBuildDir = path.join(buildDir, 'hyperloop', 'android');
		fs.ensureDirSync(hyperloopBuildDir);

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

		cli.on('build.android.dexer', {
			pre: function (data, finished) {
				// Add Hyperloop exclusive JARs
				data.args[1] = data.args[1].concat(exclusiveJars);
				finished();
			}
		});

		prepareBuild(builder, next);

	};

	/**
	 * Sets up the build for using the hyperloop module.
	 */
	function prepareBuild(builder, callback) {
		var metabaseJSON,
			jars,
			jarHashes = {},
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
				var libraryFilenames = depMap.libraries.appcompat;
				libraryFilenames = libraryFilenames.concat(depMap.libraries.design || []);
				libraryFilenames.forEach(function(libraryFilename) {
					var libraryPathAndFilename = path.join(builder.platformPath, libraryFilename);
					if (!afs.exists(libraryPathAndFilename)) {
						return;
					}

					if (builder.isExternalAndroidLibraryAvailable(libraryPathAndFilename)) {
						return;
					}

					jars.push(libraryPathAndFilename);
				});

				next();
			},
			/**
			 * Manually adds JARs from module's lib directory and any JARs contained
			 * in AARs
			 *
			 * The dupe check is duplicate code as the AndroidBuilder does the same in
			 * compileJavaClasses method, but that is too late in the build pipeline
			 * so we can't use it. Once the AndroidBuilder gets an overhaul we can
			 * consider removing this and simply require a pre filtered list directly
			 * from the builder.
			 *
			 * @param {Function} next Callback function
			 */
			function (next) {
				var jarRegExp = /\.jar$/;
				builder.modules.forEach(function(module) {
					var libDir = path.join(module.modulePath, 'lib');
					fs.existsSync(libDir) && fs.readdirSync(libDir).forEach(function (name) {
						var jarFile = path.join(libDir, name);
						if (jarRegExp.test(name) && fs.existsSync(jarFile)) {
							var jarHash = builder.hash(fs.readFileSync(jarFile).toString());
							if (!jarHashes[jarHash]) {
								jars.push(jarFile);
								jarHashes[jarHash] = 1;
							} else {
								logger.debug('Excluding duplicate jar file %s from metabase generation', jarFile.cyan);
							}
						}
					}, this);
				});

				builder.androidLibraries.forEach(function (libraryInfo) {
					libraryInfo.jars.forEach(function (libraryJarPathAndFilename) {
						var jarHash = builder.hash(fs.readFileSync(libraryJarPathAndFilename).toString());
						if (!jarHashes[jarHash]) {
							jars.push(libraryJarPathAndFilename);
							jarHashes[jarHash] = 1;
						} else {
							logger.debug('Excluding duplicate jar file %s from metabase generation', libraryJarPathAndFilename.cyan);
						}
					}, this);
				}, this);

				next();
			},
			/**
			 * Finds additional 3rd-party JARs that are exclusive to Hyperloop usage
			 * @param {Function} next Callback function
			 */
			function (next) {
				if (!afs.exists(platformAndroid)) {
					return next();
				}
				findit(platformAndroid)
					.on('file', function (file) {
						if (path.extname(file) === '.jar') {
							jars.push(file);
						}
					})
					.on('end', next);
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
	}
})();

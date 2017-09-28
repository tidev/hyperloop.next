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
		chalk = require('chalk'),
		appc = require('node-appc'),
		async = require('async'),
		metabase = require(path.join(__dirname, 'metabase')),
		CopySourcesTask = require('./tasks/copy-sources-task'),
		GenerateMetabaseTask = require('./tasks/generate-metabase-task'),
		GenerateSourcesTask = require('./tasks/generate-sources-task'),
		ScanReferencesTask = require('./tasks/scan-references-task');

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
		references = new Map(),
		files = {},
		exclusiveJars = [],
		aars = {},
		cleanup = [];

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
			pre: function (data, finished) {
				var sourcePathAndFilename = data.args[0];
				if (references.has(sourcePathAndFilename)) {
					data.ctx._minifyJS = data.ctx.minifyJS;
					data.ctx.minifyJS = true;
				}
				finished();
			},
			post: function (data, finished) {
				var sourcePathAndFilename = data.args[0];
				if (references.has(sourcePathAndFilename)) {
					data.ctx.minifyJS = data.ctx._minifyJS;
					delete data.ctx._minifyJS;
				}
				finished();
			}
		});

		cli.on('build.android.compileJsFile', {
			priority: 99999,
			pre: function (data, finished) {
				var fn = data.args[1];
				if (files[fn]) {
					data.args[0]['original'] = files[fn];
					data.args[0]['contents'] = files[fn];
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
			sourceFiles = [],
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
			 * Manually adds JARs from module's lib directory, any JARs contained
			 * in AARs and from the android platform folder.
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
				var jarPaths = [];

				async.series([
					function scanModuleLibraries(done) {
						async.each(builder.modules, function(module, cb) {
							var libDir = path.join(module.modulePath, 'lib');
							fs.readdir(libDir, function(err, libraryEntries) {
								if (err) {
									cb();
								}

								libraryEntries.forEach(function(entryName) {
									var jarFile = path.join(libDir, entryName);
									if (jarRegExp.test(entryName)) {
										jarPaths.push(jarFile);
									}
								});

								cb();
							});
						}, done);
					},
					function scanAndroidLibraries(done) {
						builder.androidLibraries.forEach(function (libraryInfo) {
							libraryInfo.jars.forEach(function (libraryJarPathAndFilename) {
								jarPaths.push(libraryJarPathAndFilename);
							});
						});

						done();
					},
					function scanPlatformDirectory(done) {
						if (!afs.exists(platformAndroid)) {
							return done();
						}
						findit(platformAndroid)
							.on('file', function (file) {
								if (path.extname(file) === '.jar') {
									jarPaths.push(file);
									// Also add jars to the list of exclusive jars that are only
									// available to Hyperloop so they get added to the dexer.
									exclusiveJars.push(file);
								}
							})
							.on('end', done);
					},
					function generateHashes(done) {
						async.each(jarPaths, function(jarPathAndFilename, cb) {
							fs.readFile(jarPathAndFilename, function(err, buffer) {
								if (err) {
									cb();
								}

								var jarHash = builder.hash(buffer.toString());
								jarHashes[jarHash] = jarHashes[jarHash] || [];
								jarHashes[jarHash].push(jarPathAndFilename);

								cb();
							});
						}, done);
					},
					function filterDuplicates(done) {
						Object.keys(jarHashes).forEach(function (hash) {
							jars.push(jarHashes[hash][0]);

							if (jarHashes[hash].length > 1) {
								logger.debug('Duplicate jar libraries detected, using only the first of the following libraries for metabase generation:');
								jarHashes[hash].forEach(function (jarPathAndFilename) {
									logger.debug('  ' + jarPathAndFilename.cyan);
								});
							}
						});

						done();
					}
				], next);
			},
			// Do metabase generation from JARs
			function (next) {
				// TODO It'd be good to split out some mapping between the JAR and the types inside it.
				// Then we can know if a JAR file is "unused" and not copy/package it!
				// Kind of similar to how Jeff detects system frameworks and maps includes by framework.
				// we can map requires by containing JAR

				// Simple way may be to generate a "metabase" per-JAR
				var task = new GenerateMetabaseTask({
					name: 'hyperloop:generateMetabase',
					inputFiles: jars,
					logger: logger
				});
				task.builder = builder;
				task.run().then(() => {
					metabaseJSON = task.metabase;
					next();
				}).catch(next);
			},
			function (next) {
				// Need to generate the metabase first to know the full set of possible native requires as a filter when we look at requires in user's JS!
				// look for any reference to hyperloop native libraries in our JS files
				async.each(sourceFolders, function(folder, cb) {
					findit(folder)
						.on('file', function (file) {
							// Only consider JS files.
							if (path.extname(file) !== '.js') {
								return;
							}
							sourceFiles.push(file);
						})
						.on('end', function () {
							cb();
						});
				}, function(err) {
					if (err) {
						return next(err);
					}

					var task = new ScanReferencesTask({
						name: 'hyperloop:scanReferences',
						incrementalDirectory: path.join(hyperloopBuildDir, 'incremental', 'scanReferences'),
						inputFiles: sourceFiles,
						logger: logger
					});
					task.outputDirectory = path.join(hyperloopBuildDir, 'references');
					task.metabase = metabaseJSON;
					task.postTaskRun = () => {
						task.references.forEach((fileInfo, pathAndFilename) => {
							references.set(pathAndFilename, fileInfo);
							files[pathAndFilename] = fileInfo.replacedContent;
						});
					};
					task.run().then(next).catch(next);
				});
			},
			function (next) {
				var task = new GenerateSourcesTask({
					name: 'hyperloop:generateSources',
					incrementalDirectory: path.join(hyperloopBuildDir, 'incremental', 'generateSources'),
					inputFiles: sourceFiles,
					logger: logger
				});
				task.outputDirectory = path.join(hyperloopBuildDir, 'js');
				task.metabase = metabaseJSON;
				task.references = references;
				task.run().then(next).catch(next);
			},
			function (next) {
				var hyperloopSourcesPath = path.join(hyperloopBuildDir, 'js');
				var task = new CopySourcesTask({
					name: 'hyperloop:copySources',
					incrementalDirectory: path.join(hyperloopBuildDir, 'incremental', 'copySources'),
					logger: logger
				});
				task.sourceDirectory = hyperloopSourcesPath;
				task.outputDirectory = path.join(builder.buildBinAssetsResourcesDir, 'hyperloop');
				task.builder = builder;
				task.postTaskRun = function () {
					// Make sure our copied files won't be deleted by the builder since we
					// process them outside the build pipeline's copy resources phase
					task.outputFiles.forEach(function(pathAndFilename) {
						if (builder.lastBuildFiles[pathAndFilename]) {
							delete builder.lastBuildFiles[pathAndFilename];
						}
					});
				};
				task.run().then(next).catch(next);
			}
		], function (err) {
			if (err) {
				return callback(err);
			}

			callback();
		});
	}
})();

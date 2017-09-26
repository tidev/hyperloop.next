/**
 * Hyperloop ® plugin for Windows
 * Copyright (c) 2015-Present by Appcelerator, Inc.
 * All Rights Reserved. This library contains intellectual
 * property protected by patents and/or patents pending.
 */
'use strict';

/** The plugin's identifier */
exports.id = 'hyperloop';

/** The Titanium CLI version that this hook is compatible with */
exports.cliVersion = '>=3.2';

(function () {
	const fs = require('fs'),
		ejs = require('ejs'),
		path = require('path'),
		spawn = require('child_process').spawn, // eslint-disable-line security/detect-child-process
		wrench = require('wrench');

	// State
	const state = {};

	// set this to enforce a minimum Titanium SDK
	const TI_MIN = '6.1.0';

	// Hyperloop Build for Windows
	function HyperloopWindowsBuilder (logger, config, cli, appc, hyperloopConfig, builder) {
		this.logger  = logger;
		this.config  = config;
		this.cli     = cli;
		this.appc    = appc;
		this.cfg     = hyperloopConfig;
		this.builder = builder;
	}

	HyperloopWindowsBuilder.prototype.init = function (next) {
		this.appc.async.series(this, [
			'validate',
			'setup'
		], next);
	};

	HyperloopWindowsBuilder.prototype.validate = function (next) {
		// hyperloop requires a later version
		if (!this.appc.version.gte(this.builder.titaniumSdkVersion, TI_MIN)) {
			this.logger.error('You cannot use the Hyperloop compiler with a version of Titanium older than ' + TI_MIN);
			this.logger.error('Set the value of <sdk-version> to a newer version in tiapp.xml.');
			this.logger.error('For example:');
			this.logger.error('	<sdk-version>' + TI_MIN + '.GA</sdk-version>\n');
			process.exit(1);
		}
		next();
	};

	HyperloopWindowsBuilder.prototype.setup = function (next) {
		const logger      = this.logger,
			builder     = this.builder,
			windowsInfo = this.builder.windowsInfo,
			t_ = this;

		// Overrides Hyperloop code generation
		builder.useHyperloopBuilder = true;

		state.thirdpartyLibraries = builder.hyperloopConfig.windows.thirdparty && Object.keys(builder.hyperloopConfig.windows.thirdparty) || [];
		state.buildDir            = builder.buildDir;
		state.hyperloopBuildDir   = path.join(builder.buildDir, 'TitaniumWindows_Hyperloop');

		this.builder.cli.on('build.windows.analyzeJsFile', {
			pre: function (data, finished) {
				const ast  = data.args[2], // from = 0, to = 1
					traverse = data.args[3],
					types    = data.args[4];

				builder.native_types  || (builder.native_types  = {});
				builder.native_events || (builder.native_events = {});

				traverse(ast, {
					CallExpression: {
						enter: function (path) {

							// if we're calling require with one string literal argument...
							// FIXME What if it is a requires, but not a string? What if it is a dynamically built string?
							if (types.isIdentifier(path.node.callee, { name: 'require' })
									&& path.node.arguments && path.node.arguments.length === 1
									&& types.isStringLiteral(path.node.arguments[0])) {
								// check if the required type is "native"
								const node_value = path.node.arguments[0].value;
								if (t_.hasWindowsAPI(node_value)) {
									logger.info('Detected native API reference: ' + node_value);
									builder.native_types[node_value] = { name: node_value };
								}
							} else if (types.isMemberExpression(path.node.callee) // are we calling 'addEventListener'?
									&& types.isIdentifier(path.node.callee.property, { name: 'addEventListener' })
									&& path.node.arguments && path.node.arguments.length > 0 // with at least one argument
									&& types.isStringLiteral(path.node.arguments[0]) // first argument is a string literal
									&& types.isIdentifier(path.node.callee.object) // on some variable
							) {
								const event_name = path.node.arguments[0].value,  // record the event name
									binding = path.scope.getBinding(path.node.callee.object.name); // get binding for the receiver variable
								if (binding // if we got the initial binding for the variable
										&& types.isVariableDeclarator(binding.path.node) // and it declares the variable
										&& types.isNewExpression(binding.path.node.init) // and it's assigned from a 'new' expression
										&& types.isIdentifier(binding.path.node.init.callee) // and the type is an identifier
								) {
									const ctor = path.scope.getBinding(binding.path.node.init.callee.name); // and it's the constructor variable
									if (ctor && ctor.path.node.init && ctor.path.node.init.arguments && ctor.path.node.init.arguments.length > 0) {
										const detectedConstructorType = ctor.path.node.init.arguments[0].value; // record the type of the constructor
										if (t_.hasWindowsAPI(detectedConstructorType)) {
											const native_event = {
												name: event_name,
												type: detectedConstructorType,
												signature: event_name + '_' + detectedConstructorType.replace(/\./g, '_')
											};
											builder.native_events[native_event.signature] = native_event;
											logger.info('Detected native API event: ' + native_event.name + ' for ' + detectedConstructorType);
										}
									}
								}
							}
						}
					}
				});

				finished();
			}
		});

		this.builder.cli.on('build.windows.stub.generate', {
			pre: function (data, finished) {
				const sdkVersion = builder.targetPlatformSdkVersion === '10.0' ? windowsInfo.windows['10.0'].sdks[0] : builder.targetPlatformSdkVersion,
					sdkMinVersion = builder.targetPlatformSdkMinVersion === '10.0' ? sdkVersion : builder.targetPlatformSdkMinVersion;
				let platform = 'win10';

				if (sdkVersion === '8.1') {
					if (builder.cmakePlatform === 'WindowsStore') {
						platform = 'store';
					} else if (builder.cmakePlatform === 'WindowsPhone') {
						platform = 'phone';
					}
				}

				state.platform      = platform;
				state.sdkVersion    = sdkVersion;
				state.sdkMinVersion = sdkMinVersion;

				logger.debug('HyperloopWindowsBuilder Setup: ' + JSON.stringify(state, null, 2));
				t_.appc.async.series(t_, [
					function (next) {
						t_.copyNativeTemplates(next);
					},
					function (next) {
						t_.generateNativeTypeHelper(next);
					},
					function (next) {
						t_.generateNativeProject(next);
					},
					function (next) {
						t_.buildNativeTypeHelper('Debug', next);
					},
					function (next) {
						t_.buildNativeTypeHelper('Release', next);
					}
				], function () {
					finished();
				});

			},
			post: function (data, finished) {
				finished();
			}
		});

		next();

	};

	HyperloopWindowsBuilder.prototype.hasWindowsAPI = function hasWindowsAPI(node_value) {
		for (let i = 0; i < state.thirdpartyLibraries.length; i++) {
			if (node_value.indexOf(state.thirdpartyLibraries[i] + '.') === 0) {
				return true;
			}
		}
		return (node_value.indexOf('Windows.') === 0 || node_value.indexOf('System.') === 0);
	};

	HyperloopWindowsBuilder.prototype.copyNativeTemplates = function copyNativeTemplates(callback) {
		fs.existsSync(state.hyperloopBuildDir) && wrench.rmdirSyncRecursive(state.hyperloopBuildDir);

		wrench.copyDirSyncRecursive(path.join(__dirname, 'TitaniumWindows_Hyperloop'), state.hyperloopBuildDir, {
			forceDelete: true
		});

		callback();
	};

	HyperloopWindowsBuilder.prototype.generateNativeProject = function generateNativeProject(callback) {

		const dest = state.hyperloopBuildDir,
			platform = state.platform,
			builder  = this.builder,
			template = path.join(dest, platform, 'TitaniumWindows_Hyperloop.csproj.ejs'),
			csproj   = path.join(dest, platform, 'TitaniumWindows_Hyperloop.csproj'),
			externalReferences = [];

		for (let i = 0; i < state.thirdpartyLibraries.length; i++) {
			const libDir = path.join(dest, '..', 'lib', platform, builder.arch),
				relativeDir = path.join('lib', platform, builder.arch),
				exts = [ '.winmd', '.dll' ],
				libraryName = state.thirdpartyLibraries[i];

			for (let j = 0; j < exts.length; j++) {
				const hintPath = path.resolve(path.join(libDir, libraryName + exts[j]));
				if (fs.existsSync(hintPath)) {
					externalReferences.push({
						Include: libraryName,
						HintPath: hintPath,
						ContentPath: exts[j] === '.dll' ? path.join(relativeDir, libraryName + exts[j]) : null
					});
					break;
				}
			}
		}

		builder.hyperloopConfig.windows.thirdPartyReferences = externalReferences;

		fs.readFile(template, 'utf8', function (err, data) {
			if (err) {
				throw err;
			}
			data = ejs.render(data, {
				externalReferences:          externalReferences,
				targetPlatformSdkVersion:    state.sdkVersion,
				targetPlatformSdkMinVersion: state.sdkMinVersion
			}, {});

			fs.writeFile(csproj, data, function (err) {
				callback(err);
			});
		});
	};

	/**
	 * Generates the code in TypeHelper.cs to handle building up the list of native types registered.
	 * @param {Function} next -
	 */
	HyperloopWindowsBuilder.prototype.generateNativeTypeHelper = function generateNativeTypeHelper(next) {
		const dest = state.hyperloopBuildDir,
			native_types = this.builder.native_types || {},
			native_events = this.builder.native_events || {},
			helper_cs = path.join(dest, 'src', 'TypeHelper.cs'),
			template = path.join(dest, 'src', 'TypeHelper.cs.ejs'),
			logger = this.logger;

		// Now we'll add all the types we know about as includes into our TypeHelper class
		// This let's us load these types by name using C# Reflection
		logger.trace('Adding native API type listing to TypeHelper.cs...');
		fs.readFile(template, 'utf8', function (err, data) {
			if (err) {
				throw err;
			}

			data = ejs.render(data, {
				native_types:native_types,
				native_events:native_events
			}, {});

			// if contents haven't changed, don't overwrite so we don't recompile the file
			if (fs.existsSync(helper_cs) && fs.readFileSync(helper_cs, 'utf8').toString() === data) {
				logger.debug('TypeHelper.cs contents unchanged, retaining existing file.');
				next();
				return;
			}

			fs.writeFile(helper_cs, data, function (err) {
				next(err);
			});
		});
	};

	HyperloopWindowsBuilder.prototype.buildNativeTypeHelper = function buildNativeTypeHelper(buildConfiguration, callback) {
		const dest     = state.hyperloopBuildDir,
			platform = state.platform,
			slnFile  = path.join(dest, platform, 'TitaniumWindows_Hyperloop.sln'),
			t_ = this;
		this.runNuGet(slnFile, function (err) {
			if (err) {
				return callback(err);
			}
			t_.runMSBuild(slnFile, buildConfiguration, callback);
		});
	};

	HyperloopWindowsBuilder.prototype.runNuGet = function runNuGet(slnFile, callback) {
		const logger = this.logger;

		logger.debug('nuget restore ' + slnFile);

		// Make sure project dependencies are installed via NuGet
		const nuget = path.resolve(this.builder.titaniumSdkPath, 'windows', 'cli', 'vendor', 'nuget', 'nuget.exe'),
			p = spawn(nuget, [ 'restore', slnFile ]);
		p.stdout.on('data', function (data) {
			var line = data.toString().trim();
			if (line.indexOf('error ') >= 0) {
				logger.error(line);
			} else if (line.indexOf('warning ') >= 0) {
				logger.warn(line);
			} else if (line.indexOf(':\\') === -1) {
				logger.debug(line);
			} else {
				logger.trace(line);
			}
		});
		p.stderr.on('data', function (data) {
			logger.warn(data.toString().trim());
		});
		p.on('close', function (code) {
			if (code !== 0) {
				process.exit(1); // Exit with code from nuget?
			}
			callback();
		});
	};

	HyperloopWindowsBuilder.prototype.runMSBuild = function runMSBuild(slnFile, buildConfiguration, callback) {
		const logger = this.logger,
			windowsInfo = this.builder.windowsInfo,
			vsInfo = windowsInfo.selectedVisualStudio;

		if (!vsInfo) {
			logger.error('Unable to find a supported Visual Studio installation');
			process.exit(1);
		}

		logger.debug('Running MSBuild on solution: ' + slnFile + ' for ' + buildConfiguration);

		// Use spawn directly so we can pipe output as we go
		const p = spawn((process.env.comspec || 'cmd.exe'), [ '/S', '/C', '"', vsInfo.vsDevCmd.replace(/[ ()&]/g, '^$&')
			+ ' && MSBuild /p:Platform="Any CPU" /p:Configuration=' + buildConfiguration + ' ' + slnFile + '"'
		], { windowsVerbatimArguments: true });
		p.stdout.on('data', function (data) {
			var line = data.toString().trim();
			if (line.indexOf('error ') >= 0) {
				logger.error(line);
			} else if (line.indexOf('warning ') >= 0) {
				logger.warn(line);
			} else if (line.indexOf(':\\') === -1) {
				logger.debug(line);
			} else {
				logger.trace(line);
			}
		});
		p.stderr.on('data', function (data) {
			logger.warn(data.toString().trim());
		});
		p.on('close', function (code) {

			if (code !== 0) {
				logger.error('MSBuild fails with code ' + code);
				process.exit(1); // Exit with code from msbuild?
			}

			callback();
		});
	};

	module.exports = HyperloopWindowsBuilder;
}());

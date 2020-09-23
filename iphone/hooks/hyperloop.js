/**
 * Hyperloop ®
 * Copyright (c) 2015-2018 by Appcelerator, Inc.
 * All Rights Reserved. This library contains intellectual
 * property protected by patents and/or patents pending.
 */

'use strict';

module.exports = HyperloopiOSBuilder;

// Set this to enforce a ios-min-version
const IOS_MIN = '9.0';

// Set this to enforce a minimum Titanium SDK
const TI_MIN = '8.0.0';

// Minimum SDK to use the newer build.ios.compileJsFile hook
const COMPILE_JS_FILE_HOOK_SDK_MIN = '7.1.0';

// Set the iOS SDK minium
const IOS_SDK_MIN = '9.0';

const path = require('path');
const exec = require('child_process').exec;
const hm = require('hyperloop-metabase');
const metabase = hm.metabase;
const ModuleMetadata = metabase.ModuleMetadata;
const fs = require('fs-extra');
const crypto = require('crypto');
const chalk = require('chalk');
const async = require('async');
const HL = chalk.magenta.inverse('Hyperloop');
const semver = require('semver');

const babelParser = require('@babel/parser');
const t = require('@babel/types');
const generate = require('@babel/generator').default;
const traverse = require('@babel/traverse').default;
const generator = require('./generate');

/**
 * The Hyperloop builder object. Contains the build logic and state.
 * @class
 * @constructor
 * @param {Object} logger - The Titanium CLI logger.
 * @param {Object} config - The Titanium CLI config.
 * @param {Object} cli - The Titanium CLI instance.
 * @param {Object} appc - Reference to node-appc.
 * @param {Object} hyperloopConfig - Object containing a union of base, local, and user Hyperloop settings.
 * @param {Builder} builder - A platform specific build command Builder object.
 */
function HyperloopiOSBuilder(logger, config, cli, appc, hyperloopConfig, builder) {
	this.logger = logger;
	this.config = config;
	this.cli = cli;
	this.appc = appc;
	this.hyperloopConfig = hyperloopConfig || {};
	this.hyperloopConfig.ios || (this.hyperloopConfig.ios = {});
	this.builder = builder;

	this.resourcesDir = path.join(builder.projectDir, 'Resources');
	this.hyperloopBuildDir = path.join(builder.projectDir, 'build', 'hyperloop', 'ios');
	this.hyperloopJSDir = path.join(this.hyperloopBuildDir, 'js');
	this.hyperloopResourcesDir = path.join(this.builder.xcodeAppDir, 'hyperloop');

	this.forceMetabase = false;
	this.forceStubGeneration = false;
	this.parserState = null;
	this.frameworks = new Map();
	this.systemFrameworks = new Map();
	this.thirdPartyFrameworks = new Map();
	this.includes = [];
	this.swiftSources = [];
	this.swiftVersion = '3.0';
	this.jsFiles = {};
	this.references = {};
	this.usedFrameworks = new Map();
	this.metabase = {};
	this.nativeModules = {};
	this.hasCocoaPods = false;
	this.cocoaPodsBuildSettings = {};
	this.cocoaPodsProducts = [];
	this.headers = null;
	this.needMigration = {};

	// set our CLI logger
	hm.util.setLog(builder.logger);
}

/**
 * called for each JS resource to process them
 */
HyperloopiOSBuilder.prototype.compileJsFile = function (builder, callback) {
	try {
		const obj = builder.args[0];
		const from = builder.args[1];
		const to = builder.args[2];

		this.patchJSFile(obj, from, to, callback);
	} catch (e) {
		callback(e);
	}
};

/**
 * The main build logic.
 * @param {Function} callback - A function to call after the logic finishes.
 */
HyperloopiOSBuilder.prototype.init = function init(callback) {
	this.appc.async.series(this, [
		'validate',
		'setup',
		'wireupBuildHooks',
		'getSystemFrameworks',
		'generateCocoaPods',
		'processThirdPartyFrameworks',
		'detectSwiftVersion'
	], callback);
};

HyperloopiOSBuilder.prototype.run = function run(builder, callback) {
	var start = Date.now();
	this.logger.info('Starting ' + HL + ' assembly');
	this.appc.async.series(this, [
		'generateSourceFiles',
		'generateSymbolReference',
		'compileResources',
		'generateStubs',
		'copyHyperloopJSFiles',
		'updateXcodeProject'
	], function (err) {
		if (err instanceof StopHyperloopCompileError) {
			err = null;
		}
		this.logger.info('Finished ' + HL + ' assembly in ' + (Math.round((Date.now() - start) / 10) / 100) + ' seconds');
		callback(err);
	});
};

/**
 * Validates the settings and environment.
 */
HyperloopiOSBuilder.prototype.validate = function validate() {
	// hyperloop requires a minimum iOS SDK
	if (!this.appc.version.gte(this.builder.iosSdkVersion, IOS_SDK_MIN)) {
		this.logger.error('You cannot use the Hyperloop compiler with a version of iOS SDK older than ' + IOS_SDK_MIN);
		this.logger.error('Please update to the latest iOS SDK and try again.\n');
		process.exit(1);
	}

	// hyperloop requires a later version
	if (!this.appc.version.gte(this.builder.titaniumSdkVersion, TI_MIN)) {
		this.logger.error('You cannot use the Hyperloop compiler with a version of Titanium older than ' + TI_MIN);
		this.logger.error('Set the value of <sdk-version> to a newer version in tiapp.xml.');
		this.logger.error('For example:');
		this.logger.error('	<sdk-version>' + TI_MIN + '.GA</sdk-version>\n');
		process.exit(1);
	}

	// check that hyperloop module was found in the tiapp.xml
	var usingHyperloop = this.builder.tiapp.modules.some(function (m) {
		return m.id === 'hyperloop' && (!m.platform || m.platform.indexOf('ios') !== -1 || m.platform.indexOf('iphone') !== -1);
	});
	if (!usingHyperloop) {
		var pkg = require(path.join(__dirname, '..', 'package.json'));
		this.logger.error('You cannot use the Hyperloop compiler without configuring the module.');
		this.logger.error('Add the following to your tiapp.xml <modules> section:');
		this.logger.error('');
		this.logger.error('	<module version="' + pkg.version + '" platform="ios">hyperloop</module>\n');
		process.exit(1);
	}

	if (!(this.builder.tiapp.properties && this.builder.tiapp.properties.hasOwnProperty('run-on-main-thread') && this.builder.tiapp.properties['run-on-main-thread'].value)) {
		this.logger.error('You cannot use the Hyperloop compiler without configuring iOS to use main thread execution.');
		this.logger.error('Add the following to your tiapp.xml <ti:app> section:');
		this.logger.error('');
		this.logger.error('	<property name="run-on-main-thread" type="bool">true</property>');
		process.exit(1);
	}

	// check for min ios version
	if (this.appc.version.lt(this.builder.minIosVer, IOS_MIN)) {
		this.logger.error('Hyperloop compiler works best with iOS ' + IOS_MIN + ' or greater.');
		this.logger.error('Your setting is currently set to: ' + (this.builder.tiapp.ios['min-ios-ver'] || this.builder.minIosVer));
		this.logger.error('You can change the version by adding the following to your');
		this.logger.error('tiapp.xml <ios> section:');
		this.logger.error('');
		this.logger.error('	<min-ios-ver>' + IOS_MIN + '</min-ios-ver>\n');
		process.exit(1);
	}

	var defaultXcodePath = path.join('/Applications', 'Xcode.app');
	if (!fs.existsSync(defaultXcodePath)) {
		this.logger.error('Hyperloop requires Xcode to be located at its default location under ' + defaultXcodePath);
		this.logger.error('Please make sure to move Xcode to this location before continuing. For further information');
		this.logger.error('on this issue check https://jira.appcelerator.org/browse/TIMOB-23956');
		process.exit(1);
	}
};

/**
 * Sets up the build for the Hyperloop module.
 * @param {Function} callback - A function to call when all setup tasks have completed.
 */
HyperloopiOSBuilder.prototype.setup = function setup() {
	// create a temporary hyperloop directory
	fs.ensureDirSync(this.hyperloopBuildDir);
};

/**
 * Gets the system frameworks from the Hyperloop Metabase.
 */
HyperloopiOSBuilder.prototype.getSystemFrameworks = function getSystemFrameworks(callback) {
	hm.metabase.getSystemFrameworks(this.hyperloopBuildDir, this.builder.xcodeTargetOS, this.builder.minIosVer, function (err, systemFrameworks) {
		if (!err) {
			this.systemFrameworks = new Map(systemFrameworks);

			this.sdkInfo = this.systemFrameworks.get('$metadata');
			this.systemFrameworks.delete('$metadata');

			this.systemFrameworks.forEach(frameworkMetadata => {
				this.frameworks.set(frameworkMetadata.name, frameworkMetadata);
			}, this);
		}

		callback(err);
	}.bind(this));
};

/**
 * Has the Hyperloop Metabase generate the CocoaPods and then adds the symbols to the map of frameworks.
 */
HyperloopiOSBuilder.prototype.generateCocoaPods = function generateCocoaPods(callback) {
	// attempt to handle CocoaPods for third-party frameworks
	hm.metabase.generateCocoaPods(this.hyperloopBuildDir, this.builder, function (err, settings, modules) {
		if (!err) {
			this.hasCocoaPods = modules && modules.size > 0;
			if (this.hasCocoaPods) {
				this.cocoaPodsBuildSettings = settings || {};
				modules.forEach(metadata => {
					this.frameworks.set(metadata.name, metadata);
					this.cocoaPodsProducts.push(metadata.name);
				}, this);
			}
		}
		callback(err);
	}.bind(this));
};

/**
 * Gets frameworks for any third-party dependencies defined in the Hyperloop config and compiles them.
 */
HyperloopiOSBuilder.prototype.processThirdPartyFrameworks = function processThirdPartyFrameworks(callback) {
	var frameworks = this.frameworks;
	var thirdPartyFrameworks = this.thirdPartyFrameworks;
	var swiftSources = this.swiftSources;
	var hyperloopBuildDir = this.hyperloopBuildDir;
	var thirdparty = this.hyperloopConfig.ios.thirdparty || [];
	var projectDir = this.builder.projectDir;
	var xcodeAppDir = this.builder.xcodeAppDir;
	var sdk = this.builder.xcodeTargetOS + this.builder.iosSdkVersion;
	var builder = this.builder;
	var logger = this.logger;

	function arrayifyAndResolve(it) {
		if (it) {
			return (Array.isArray(it) ? it : [ it ]).map(function (name) {
				return path.resolve(projectDir, name);
			});
		}
		return null;
	}

	/**
	 * Processes any frameworks from modules or the app's platform/ios folder
	 *
	 * @param {Function} next Callback function
	 */
	function processFrameworks(next) {
		if (!builder.frameworks || Object.keys(builder.frameworks).length === 0) {
			return next();
		}

		hm.metabase.generateUserFrameworksMetadata(builder.frameworks, hyperloopBuildDir, function (err, modules) {
			if (err) {
				return next(err);
			}

			modules.forEach(moduleMetadata => {
				thirdPartyFrameworks.set(moduleMetadata.name, moduleMetadata);
				frameworks.set(moduleMetadata.name, moduleMetadata);
			});
			return next();
		});
	}

	/**
	 * Processes third-party dependencies that are configured under the
	 * hyperloop.ios.thirdparty key
	 *
	 * These can be both uncompiled Swift and Objective-C source files as well as
	 * Frameworks.
	 *
	 * @param {Function} next Callback function
	 */
	function processConfiguredThirdPartySource(next) {
		async.eachLimit(Object.keys(thirdparty), 5, function (frameworkName, next) {
			var lib = thirdparty[frameworkName];

			logger.debug('Generating includes for third-party source ' + frameworkName.green + ' (defined in appc.js)');
			async.series([
				function (cb) {
					var headers = arrayifyAndResolve(lib.header);
					if (headers) {
						hm.metabase.generateUserSourceMappings(
							hyperloopBuildDir,
							headers,
							function (err, includes) {
								if (!err && includes && includes[frameworkName]) {
									const metadata = new ModuleMetadata(frameworkName, headers[0], ModuleMetadata.MODULE_TYPE_STATIC);
									metadata.typeMap = includes[frameworkName];
									frameworks.set(metadata.name, metadata);
								}
								cb(err);
							},
							frameworkName
						);
					} else {
						cb();
					}
				},

				function (cb) {
					var resources = arrayifyAndResolve(lib.resource);
					if (resources) {
						var extRegExp = /\.(xib|storyboard|m|mm|cpp|h|hpp|swift|xcdatamodel)$/;
						async.eachLimit(resources, 5, function (dir, cb2) {
							// compile the resources (.xib, .xcdatamodel, .xcdatamodeld,
							// .xcmappingmodel, .xcassets, .storyboard)
							hm.metabase.compileResources(dir, sdk, xcodeAppDir, false, function (err) {
								if (!err) {
									builder.copyDirSync(dir, xcodeAppDir, {
										ignoreFiles: extRegExp
									});
								}

								cb2(err);
							});
						}, cb);
					} else {
						cb();
					}
				},

				function (cb) {
					// generate metabase for swift files (if found)
					var sources = arrayifyAndResolve(lib.source);
					var swiftRegExp = /\.swift$/;

					sources && sources.forEach(function (dir) {
						fs.readdirSync(dir).forEach(function (filename) {
							if (swiftRegExp.test(filename)) {
								swiftSources.push({
									framework: frameworkName,
									source: path.join(dir, filename)
								});
							}
						});
					});
					cb();
				}
			], next);
		}, next);
	}

	async.series([
		processFrameworks,
		processConfiguredThirdPartySource
	], callback);
};

/**
 * Detects the configured swift version
 */
HyperloopiOSBuilder.prototype.detectSwiftVersion = function detectSwiftVersion(callback) {
	var that = this;
	exec('/usr/bin/xcrun swift -version', function (err, stdout) {
		if (err) { return callback(err); }
		var versionMatch = stdout.match(/version\s(\d.\d)/);
		if (versionMatch !== null) {
			that.swiftVersion = versionMatch[1];
		}
		callback();
	});
};

/**
 * Re-write generated JS source
 * @param {Object} obj - JS object holding data about the file
 * @param {String} obj.contents - current source code for the file
 * @param {String} obj.original - original source of the file
 * @param {String} sourceFilename - path to original JS file
 * @param {String} destinationFilename - path to destination JS file
 * @param {Function} cb - callback function
 */
HyperloopiOSBuilder.prototype.patchJSFile = function patchJSFile(obj, sourceFilename, destinationFilename, cb) {
	const contents = obj.contents;
	// skip empty content
	if (!contents.length) {
		return cb();
	}

	// look for any require which matches our hyperloop system frameworks

	// parse the contents
	// TODO: move all the HyperloopVisitor require/import manipulation into the parser call right here
	// Otherwise we do two parser/ast-traversal/generation passes!
	this.parserState = generator.parseFromBuffer(contents, sourceFilename, this.parserState || undefined);

	// empty AST
	if (!this.parserState) {
		return cb();
	}

	const relPath = path.relative(this.resourcesDir, destinationFilename);

	// get the result source code in case it was transformed and replace all system framework
	// require() calls with the Hyperloop layer
	const requireRegexp = /[\w_/\-\\.]+/ig;
	const self = this;
	let changedAST = false;
	const HyperloopVisitor = {
		// ES5-style require calls
		CallExpression: function (p) {
			const theString = p.node.arguments[0];
			let requireMatch;
			if (p.get('callee').isIdentifier({ name: 'require' }) // Is this a require call?
				&& theString && t.isStringLiteral(theString)     // Is the 1st param a literal string?
				&& (requireMatch = theString.value.match(requireRegexp)) !== null // Is it a hyperloop require?
			) {
				// hyperloop includes will always have a slash
				const tok = requireMatch[0].split('/');
				const pkg = tok[0];

				// is it a normal js require or from alloy? do nothing...
				if (pkg === 'alloy' || pkg.charAt(0) === '.' || pkg.charAt(0) === '/') {
					return;
				}

				// if we use something like require("UIKit")
				// that should require the helper such as require("UIKit/UIKit");
				const className = tok[1] || pkg;
				const framework = self.frameworks.get(pkg);
				const include = framework && framework.typeMap[className];
				const isBuiltin = pkg === 'Titanium';

				self.logger.trace('Checking require for: ' + pkg.toLowerCase() + '/' + className.toLowerCase());

				// if the framework is not found, then check if it was possibly mispelled
				if (!framework && !isBuiltin) {
					const pkgSoundEx = soundEx(pkg);
					const maybes = Array.from(self.frameworks.keys()).filter(function (frameworkName) {
						return soundEx(frameworkName) === pkgSoundEx;
					});

					if (maybes.length) {
						self.logger.warn('The iOS framework "' + pkg + '" could not be found. Are you trying to use '
							+ maybes.map(function (s) { return '"' + s + '"'; }).join(' or ') + ' instead? (' + relPath + ')');
					}
					// don't inject anything
					return;
				}

				// remember any used frameworks
				if (!isBuiltin) {
					self.usedFrameworks.set(pkg, self.frameworks.get(pkg));
				}

				// if we haven't found it by now, then we try to help before failing
				if (!include && className !== pkg && !isBuiltin) {
					const classNameSoundEx = soundEx(className);

					self.frameworks.forEach(frameworkMetadata => {
						if (frameworkMetadata.typeMap[className]) {
							throw new Error('Are you trying to use the iOS class "' + className + '" located in the framework "' + frameworkMetadata.name + '", not in "' + pkg + '"? (' + relPath + ')');
						}

						if (soundEx(frameworkMetadata.name) === classNameSoundEx) {
							throw new Error('The iOS class "' + className + '" could not be found in the framework "' + pkg + '". Are you trying to use "' + frameworkMetadata.name + '" instead? (' + relPath + ')');
						}
					}, self);

					throw new Error('The iOS class "' + className + '" could not be found in the framework "' + pkg + '". (' + relPath + ')');
				}

				const ref = 'hyperloop/' + pkg.toLowerCase() + '/' + className.toLowerCase();
				self.references[ref] = 1;

				if (include) {
					// record our includes in which case we found a match
					self.includes[include] = 1;
				}

				// replace the require to point to our generated file path
				p.replaceWith(
					t.callExpression(p.node.callee, [ t.stringLiteral('/' + ref) ])
				);
				changedAST = true;
			}
		},
		// ES6+-style imports
		ImportDeclaration: function (p) {
			const theString = p.node.source;
			const replacements = [];
			let requireMatch;
			if (theString && t.isStringLiteral(theString)   // module name is a string literal
				&& (requireMatch = theString.value.match(requireRegexp)) !== null // Is it a hyperloop require?
			) {
				// hyperloop includes will always have a slash
				const tok = requireMatch[0].split('/');
				const pkg = tok[0];

				// is it a normal js require or from alloy? do nothing...
				if (pkg === 'alloy' || pkg.charAt(0) === '.' || pkg.charAt(0) === '/') {
					return;
				}
				const isBuiltin = pkg === 'Titanium';
				const framework = self.frameworks.get(pkg);

				// if the framework is not found, then check if it was possibly mispelled
				if (!framework && !isBuiltin) {
					const pkgSoundEx = soundEx(pkg);
					const maybes = Array.from(self.frameworks.keys()).filter(function (frameworkName) {
						return soundEx(frameworkName) === pkgSoundEx;
					});

					if (maybes.length) {
						self.logger.warn('The iOS framework "' + pkg + '" could not be found. Are you trying to use '
							+ maybes.map(function (s) { return '"' + s + '"'; }).join(' or ') + ' instead? (' + relPath + ')');
					}
					// don't inject anything
					return;
				}

				// remember any used frameworks
				if (!isBuiltin) {
					self.usedFrameworks.set(pkg, self.frameworks.get(pkg));
				}

				p.node.specifiers.forEach(function (spec) {
					// import UIView from 'UIKit/UIView'; spec.imported is undefined and tok[1] holds className
					// import { UIView } from 'UIKit'; spec.imported.name == 'UIView'
					const className = (spec.imported ? spec.imported.name : tok[1]);
					// What if they did:
					// import UIView from 'UIKit'; ? className would be null here. Technically this is bad import anyways
					// as it should be: import UIKit from 'UIKit/UIKit'; or import { UIView } from 'UIKit';
					// FIXME: Should we bomb out with an error saying it's ambiguous import?
					const include = framework && framework.typeMap[className];
					self.logger.trace('Checking import for: ' + pkg.toLowerCase() + '/' + className.toLowerCase());

					// if we haven't found it by now, then we try to help before failing
					if (!include && className !== pkg && !isBuiltin) {
						const classNameSoundEx = soundEx(className);

						self.frameworks.forEach(frameworkMetadata => {
							if (frameworkMetadata.typeMap[className]) {
								throw new Error('Are you trying to use the iOS class "' + className + '" located in the framework "' + frameworkMetadata.name + '", not in "' + pkg + '"? (' + relPath + ')');
							}

							if (soundEx(frameworkMetadata.name) === classNameSoundEx) {
								throw new Error('The iOS class "' + className + '" could not be found in the framework "' + pkg + '". Are you trying to use "' + frameworkMetadata.name + '" instead? (' + relPath + ')');
							}
						}, self);

						throw new Error('The iOS class "' + className + '" could not be found in the framework "' + pkg + '". (' + relPath + ')');
					}

					const ref = 'hyperloop/' + pkg.toLowerCase() + '/' + className.toLowerCase();
					self.references[ref] = 1;

					if (include) {
						// record our includes in which case we found a match
						self.includes[include] = 1;
					}

					// replace the import to point to our generated file path
					replacements.push(t.importDeclaration([ t.importDefaultSpecifier(spec.local) ], t.stringLiteral('/' + ref)));
				});

				// Apply replacements
				const replaceCount = replacements.length;
				if (replaceCount === 1) {
					p.replaceWith(replacements[0]);
					changedAST = true;
				} else if (replaceCount > 1) {
					p.replaceWithMultiple(replacements);
					changedAST = true;
				}
			}
		}
	};

	const ast = babelParser.parse(contents, { sourceFilename: sourceFilename, sourceType: 'unambiguous' });
	traverse(ast, HyperloopVisitor);
	// if we didn't change the AST, no need to generate new source!
	// If we *do* generate new source, try to retain the lines and comments to retain source map
	let newContents = changedAST ? generate(ast, { retainLines: true, comments: true }, contents).code : contents;

	// TODO: Remove once we combine the custom acorn-based parser and the babelParser parser above!
	// Or maybe it can go now? The migration stuff is noted that it could be removed in 3.0.0...
	var needMigration = this.parserState.state.needMigration;
	if (needMigration.length > 0) {
		this.needMigration[sourceFilename] = needMigration;

		needMigration.forEach(function (token) {
			newContents = newContents.replace(token.objectName + '.' + token.methodName + '()', token.objectName + '.' + token.methodName);
		});
	}

	if (contents === newContents) {
		this.logger.debug('No change, skipping ' + chalk.cyan(destinationFilename));
	} else {
		this.logger.debug('Writing ' + chalk.cyan(destinationFilename));
		// modify the contents stored in the state object passed through the hook,
		// so that SDK CLI can use new contents for minification/transpilation
		obj.contents = newContents;
	}
	cb();
};

/**
 * Generates the metabase from the required Hyperloop files and then generate the source the source
 * files from that metabase.
 */
HyperloopiOSBuilder.prototype.generateSourceFiles = function generateSourceFiles(callback) {
	// no hyperloop files detected, we can stop here
	if (!this.includes.length && !Object.keys(this.references).length) {
		this.logger.info('Skipping ' + HL + ' compile, no usage found ...');
		return callback(new StopHyperloopCompileError());
	}

	fs.ensureDirSync(this.hyperloopJSDir);

	if (this.builder.forceCleanBuild || this.forceMetabase) {
		this.logger.trace('Forcing a metabase rebuild');
	} else {
		this.logger.trace('Not necessarily forcing a metabase rebuild if already cached');
	}

	function generateMetabaseCallback(err, metabase, outfile, header, cached) {
		if (err) {
			return callback(err);
		}

		this.metabase = metabase;
		this.metabase.classes = this.metabase.classes || {};

		if (!cached) {
			this.normalizeFrameworks(outfile);
			this.determineFrameworkAvailability();
		} else {
			this.populateFrameworkAvailabiltyFromCache();
		}

		if (cached && this.swiftSources.length === 0 && !this.forceMetabase) {
			// if cached, skip generation
			this.logger.info('Skipping ' + HL + ' compile, already generated...');
			return callback();
		}

		// this has to be serial because each successful call to generateSwiftMetabase() returns a
		// new metabase object that will be passed into the next file
		async.eachSeries(this.swiftSources, function (entry, cb) {
			this.logger.info('Generating metabase for swift ' + chalk.cyan(entry.framework + ' ' + entry.source));
			hm.metabase.generateSwiftMetabase(
				this.hyperloopBuildDir,
				this.sdkInfo.sdkType,
				this.sdkInfo.sdkPath,
				this.sdkInfo.minVersion,
				this.builder.xcodeTargetOS,
				this.metabase,
				entry.framework,
				entry.source,
				function (err, result, newMetabase) {
					if (!err) {
						this.metabase = newMetabase;
					} else if (result) {
						this.logger.error(result);
					}
					cb(err);
				}.bind(this)
			);
		}.bind(this), callback);
	}

	var extraHeaderSearchPaths = [];
	var extraFrameworkSearchPaths = [];
	if (this.hasCocoaPods) {
		var addSearchPathsFromCocoaPods = function (target, source) {
			if (!source) {
				return;
			}

			var cocoaPodsRoot = this.cocoaPodsBuildSettings.PODS_ROOT;
			var cocoaPodsConfigurationBuildDir = path.join(this.builder.projectDir, 'build/iphone/build/Products', this.builder.xcodeTarget + '-' + this.builder.xcodeTargetOS);
			var paths = source.split(' ');
			paths.forEach(function (path) {
				if (path === '$(inherited)') {
					return;
				}

				var searchPath = path.replace('${PODS_ROOT}', cocoaPodsRoot);
				searchPath = searchPath.replace(/\$(\{)?(PODS_CONFIGURATION_BUILD_DIR)(\})?/, cocoaPodsConfigurationBuildDir);
				searchPath = searchPath.replace(/"/g, '');

				target.push(searchPath);
			});
		}.bind(this);

		addSearchPathsFromCocoaPods(extraHeaderSearchPaths, this.cocoaPodsBuildSettings.HEADER_SEARCH_PATHS);
		addSearchPathsFromCocoaPods(extraFrameworkSearchPaths, this.cocoaPodsBuildSettings.FRAMEWORK_SEARCH_PATHS);
	}
	if (this.hyperloopConfig.ios.thirdparty) {
		// Throw a deprecation warning regarding thirdparty-references in the appc.js
		this.logger.warn('Defining third-party sources and frameworks in appc.js via the \'thirdparty\' section has been deprecated in Hyperloop 2.2.0 and will be removed in 5.0.0. The preferred way to provide third-party sources is either via dropping frameworks into the project\'s platform/ios folder or by using CocoaPods.');

		this.headers = [];
		Object.keys(this.hyperloopConfig.ios.thirdparty).forEach(function (frameworkName) {
			var thirdPartyFrameworkConfig = this.hyperloopConfig.ios.thirdparty[frameworkName];
			var headerPaths = Array.isArray(thirdPartyFrameworkConfig.header) ? thirdPartyFrameworkConfig.header : [ thirdPartyFrameworkConfig.header ];
			headerPaths.forEach(function (headerPath) {
				var searchPath = path.resolve(this.builder.projectDir, headerPath);
				extraHeaderSearchPaths.push(searchPath);
				extraFrameworkSearchPaths.push(searchPath);
				this.headers.push(searchPath);
			}, this);
		}, this);
	}
	if (this.builder.frameworks) {
		Object.keys(this.builder.frameworks).forEach(function (frameworkName) {
			var frameworkInfo = this.builder.frameworks[frameworkName];
			extraFrameworkSearchPaths.push(path.dirname(frameworkInfo.path));
		}, this);
	}

	// Framwork umbrella headers are required to propery resolve forward declarations
	this.frameworks.forEach(frameworkMeta => {
		if (!frameworkMeta.umbrellaHeader || !fs.existsSync(frameworkMeta.umbrellaHeader)) {
			this.logger.warn(`Unable to detect framework umbrella header for ${frameworkMeta.name}.`);
		}

		this.includes[frameworkMeta.umbrellaHeader] = 1;
	});

	// generate the metabase from our includes
	hm.metabase.generateMetabase(
		this.hyperloopBuildDir,
		this.sdkInfo.sdkType,
		this.sdkInfo.sdkPath,
		this.sdkInfo.minVersion,
		Object.keys(this.includes),
		false, // don't exclude system libraries
		generateMetabaseCallback.bind(this),
		this.builder.forceCleanBuild || this.forceMetabase,
		extraHeaderSearchPaths,
		extraFrameworkSearchPaths
	);
};

/**
 * Iterates over the metadata object and normalizes all framework properties.
 *
 * The metabase parser will leave the framework property as the path to the header
 * file the symbol was found in if it is not contained in a .framework package.
 *
 * This normalization will try to associate the path with the actual framework
 * name taken from our include map. Should the path be unknown we remove the
 * framework property as it is a symbol which cannot be associated to a specific
 * framework and we can't handle such symbols currently.
 *
 * @param {Object} metadata Metabdata object for a symbol (class, struct etc)
 * @param {Object} fileToFrameworkMap Map with all known mappings of header files to their framework
 */
HyperloopiOSBuilder.prototype.normalizeFrameworks = function normalizeFrameworks(outfile) {
	if (this.frameworks.size === 0) {
		return;
	}

	var headerToFrameworkMap = {};
	for (const metadata of this.frameworks.values()) {
		var classes = Object.keys(metadata.typeMap);
		for (var c = 0; c < classes.length; c++) {
			var headerPathAndFilename = metadata.typeMap[classes[c]];
			headerToFrameworkMap[headerPathAndFilename] = metadata.name;
		}
	}

	function normalizeFrameworksInGroup(metadataGroup) {
		if (!metadataGroup) {
			return;
		}
		Object.keys(metadataGroup).forEach(function (entryName) {
			var metadata = metadataGroup[entryName];
			if (metadata.framework[0] !== '/') {
				return;
			}

			if (headerToFrameworkMap[metadata.filename]) {
				metadata.framework = headerToFrameworkMap[metadata.filename];
				if (metadata.filename.indexOf('Pods/Headers/Public') === -1) {
					// All files that do not come from CocoaPods are custom third-party
					// sources configured in appc.js and need this property set to true
					// to not generate an ObjC module wrapper.
					metadata.customSource = true;
				}
			} else {
				delete metadata.framework;
			}
		});
	}

	normalizeFrameworksInGroup(this.metabase.protocols);
	normalizeFrameworksInGroup(this.metabase.classes);
	normalizeFrameworksInGroup(this.metabase.structs);
	normalizeFrameworksInGroup(this.metabase.functions);
	normalizeFrameworksInGroup(this.metabase.vars);
	normalizeFrameworksInGroup(this.metabase.enums);
	normalizeFrameworksInGroup(this.metabase.typedefs);
	if (this.metabase.blocks) {
		Object.keys(this.metabase.blocks).forEach(function (entryName) {
			if (entryName[0] === '/' && headerToFrameworkMap[entryName]) {
				var normalizedFrameworkName = headerToFrameworkMap[entryName];
				var frameworkBlocks = this.metabase.blocks[normalizedFrameworkName] || [];
				frameworkBlocks = frameworkBlocks.concat(this.metabase.blocks[entryName].filter(function (block) {
					return frameworkBlocks.every(function (existingBlock) {
						return existingBlock.signature !== block.signature;
					});
				}));
				this.metabase.blocks[normalizedFrameworkName] = frameworkBlocks;
				delete this.metabase.blocks[entryName];
			}
		}, this);
	}
	fs.writeFileSync(outfile, JSON.stringify(this.metabase, null, 2));
};

/**
 * Determines the general availability of a framework by iterating over the
 * introducedIn property of all containing classes.
 *
 * The lowest version number found will be used as the introducedIn value for the
 * framework. If no version information is available at all we set it to 0.0.0
 * which means its available on all devices.
 */
HyperloopiOSBuilder.prototype.determineFrameworkAvailability = function determineFrameworkAvailability() {
	const cacheData = {};
	const unknownIntroducedIn = '100.0.0';
	this.frameworks.forEach(metadata => {
		let earliestIntroducedIn = unknownIntroducedIn;
		Object.keys(metadata.typeMap).forEach(symbolName => {
			const classMeta = this.metabase.classes[symbolName];
			if (!classMeta || typeof classMeta.introducedIn !== 'string') {
				return;
			}

			if (semver.lt(classMeta.introducedIn, earliestIntroducedIn)) {
				earliestIntroducedIn = classMeta.introducedIn;
			}
		}, this);
		metadata.introducedIn = earliestIntroducedIn !== unknownIntroducedIn ? earliestIntroducedIn : '0.0.0';
		cacheData[metadata.name] = metadata.introducedIn;
	}, this);

	const cachePathAndFilename = path.join(this.hyperloopBuildDir, 'metadata-framework-availability.json');
	fs.writeFileSync(cachePathAndFilename, JSON.stringify(cacheData));
};

/**
 * Updates the framework map and sets all cached introducedIn values from cache.
 *
 * This only needs to be done in the main frameworks property since all other
 * Maps reference the same metadata objects.
 */
HyperloopiOSBuilder.prototype.populateFrameworkAvailabiltyFromCache = function populateFrameworkAvailabiltyFromCache() {
	const cachePathAndFilename = path.join(this.hyperloopBuildDir, 'metadata-framework-availability.json');
	let availabilityMap = {};
	try {
		availabilityMap = JSON.parse(fs.readFileSync(cachePathAndFilename));
	} catch (e) {
		return this.determineFrameworkAvailability();
	}

	Object.keys(availabilityMap).forEach(frameworkName => {
		this.frameworks.get(frameworkName).introducedIn = availabilityMap[frameworkName];
	});
};

/**
 * Generates the symbol reference based on the references from the metabase's parser state.
 */
HyperloopiOSBuilder.prototype.generateSymbolReference = function generateSymbolReference() {

	if (!this.parserState) {
		this.logger.info('Skipping ' + HL + ' generating of symbol references. Empty AST. ');
		return;
	}
	var symbolRefFile = path.join(this.hyperloopBuildDir, 'symbol_references.json'),
		json = JSON.stringify(this.parserState.getReferences(), null, 2);
	if (!fs.existsSync(symbolRefFile) || fs.readFileSync(symbolRefFile).toString() !== json) {
		this.forceStubGeneration = true;
		this.logger.trace('Forcing regeneration of wrappers');
		fs.writeFileSync(symbolRefFile, json);
	} else {
		this.logger.trace('Symbol references up-to-date');
	}
};

/**
 * Compiles the resources from the metabase.
 */
HyperloopiOSBuilder.prototype.compileResources = function compileResources(callback) {
	var sdk = this.builder.xcodeTargetOS + this.builder.iosSdkVersion;
	hm.metabase.compileResources(this.resourcesDir, sdk, this.builder.xcodeAppDir, false, callback);
};

/**
 * Generates stubs from the metabase.
 */
HyperloopiOSBuilder.prototype.generateStubs = function generateStubs(callback) {

	if (!this.parserState) {
		this.logger.info('Skipping ' + HL + ' stub generation. Empty AST.');
		return callback();
	}
	if (!this.forceStubGeneration) {
		this.logger.debug('Skipping stub generation');
		return callback();
	}

	// now generate the stubs
	this.logger.debug('Generating stubs');
	var started = Date.now();
	generator.generateFromJSON(
		this.builder.tiapp.name,
		this.metabase,
		this.parserState,
		function (err, sourceSet, modules) {
			if (err) {
				return callback(err);
			}

			var codeGenerator = new generator.CodeGenerator(sourceSet, modules, this);
			codeGenerator.generate(this.hyperloopJSDir);

			var duration = Date.now() - started;
			this.logger.info('Generation took ' + duration + ' ms');

			callback();
		}.bind(this),
		this.frameworks
	);
};

/**
 * Copies Hyperloop generated JavaScript files into the app's `Resources/hyperloop` directory.
 */
HyperloopiOSBuilder.prototype.copyHyperloopJSFiles = function copyHyperloopJSFiles() {
	// copy any native generated file references so that we can compile them
	// as part of xcodebuild
	var keys = Object.keys(this.references);

	// only if we found references, otherwise, skip
	if (!keys.length) {
		return;
	}

	// check to see if we have any specific file native modules and copy them in
	keys.forEach(function (ref) {
		var file = path.join(this.hyperloopJSDir, ref.replace(/^hyperloop\//, '') + '.m');
		if (fs.existsSync(file)) {
			this.nativeModules[file] = 1;
		}
	}, this);

	// check to see if we have any package modules and copy them in
	this.usedFrameworks.forEach(frameworkMetadata => {
		var file = path.join(this.hyperloopJSDir, frameworkMetadata.name.toLowerCase() + '/' + frameworkMetadata.name.toLowerCase() + '.m');
		if (fs.existsSync(file)) {
			this.nativeModules[file] = 1;
		}
	}, this);

	var builder = this.builder,
		logger = this.logger,
		jsRegExp = /\.js$/;

	(function scan(srcDir, destDir) {
		fs.readdirSync(srcDir).forEach(function (name) {
			var srcFile = path.join(srcDir, name),
				srcStat = fs.statSync(srcFile);

			if (srcStat.isDirectory()) {
				return scan(srcFile, path.join(destDir, name));
			}

			if (!jsRegExp.test(name)) {
				return;
			}

			var rel = path.relative(builder.projectDir, srcFile),
				destFile = path.join(destDir, name),
				destExists = fs.existsSync(destFile),
				srcMtime = JSON.parse(JSON.stringify(srcStat.mtime)),
				prev = builder.previousBuildManifest.files && builder.previousBuildManifest.files[rel],
				contents = null,
				hash = null,
				changed = !destExists || !prev || prev.size !== srcStat.size || prev.mtime !== srcMtime || prev.hash !== (hash = builder.hash(contents = fs.readFileSync(srcFile).toString()));

			builder.unmarkBuildDirFiles(destFile);

			builder.currentBuildManifest.files[rel] = {
				hash: contents === null && prev ? prev.hash : hash || builder.hash(contents || ''),
				mtime: contents === null && prev ? prev.mtime : srcMtime,
				size: contents === null && prev ? prev.size : srcStat.size
			};

			if (changed) {
				logger.debug('Writing ' + chalk.cyan(destFile));
				fs.ensureDirSync(destDir);
				fs.writeFileSync(destFile, contents || fs.readFileSync(srcFile).toString());
			} else {
				logger.trace('No change, skipping ' + chalk.cyan(destFile));
			}
		});
	}(this.hyperloopJSDir, this.hyperloopResourcesDir));

};

/**
 * Wire up the build hooks.
 */
HyperloopiOSBuilder.prototype.wireupBuildHooks = function wireupBuildHooks() {
	this.cli.on('build.ios.xcodeproject', {
		pre: this.hookUpdateXcodeProject.bind(this)
	});

	this.cli.on('build.ios.compileJsFile', {
		pre: this.compileJsFile.bind(this)
	});

	this.cli.on('build.pre.build', {
		pre: this.run.bind(this)
	});

	this.cli.on('build.ios.removeFiles', {
		pre: this.hookRemoveFiles.bind(this)
	});

	this.cli.on('build.ios.xcodebuild', {
		pre: this.hookXcodebuild.bind(this)
	});

	this.cli.on('build.post.build', {
		post: this.displayMigrationInstructions.bind(this)
	});
};

/**
 * The Xcode project build hook handler. Injects frameworks and source files into the Xcode project.
 * @param {Object} data - The hook payload.
 */
HyperloopiOSBuilder.prototype.hookUpdateXcodeProject = function hookUpdateXcodeProject(data) {
	this.xcodeprojectdata = data;
};

/**
 * Injects frameworks and source files into the Xcode project and regenerates it
 */
HyperloopiOSBuilder.prototype.updateXcodeProject = function updateXcodeProject() {
	var data = this.xcodeprojectdata;
	var nativeModules = Object.keys(this.nativeModules);

	// third party libraries won't have an entry in native modules so we explicitly
	// check for those here
	var thirdPartyFrameworksUsed = false;
	if (this.hyperloopConfig.ios.thirdparty) {
		var usedFrameworkNames = Array.from(this.usedFrameworks.keys());
		thirdPartyFrameworksUsed = Object.keys(this.hyperloopConfig.ios.thirdparty).some(function (thirdPartyFramework) {
			return usedFrameworkNames.some(function (usedFrameworkName) {
				return usedFrameworkName === thirdPartyFramework;
			}, this);
		}, this);
	}
	if (this.thirdPartyFrameworks.size > 0) {
		thirdPartyFrameworksUsed = true;
	}

	if (!nativeModules.length && !thirdPartyFrameworksUsed && !this.hasCocoaPods) {
		return;
	}

	var projectDir = this.builder.projectDir;
	var appName = this.builder.tiapp.name;
	var xcodeProject = data.args[0];
	var xobjs = xcodeProject.hash.project.objects;
	var projectUuid = xcodeProject.hash.project.rootObject;
	var pbxProject = xobjs.PBXProject[projectUuid];
	var mainTargetUuid = pbxProject.targets.filter(function (t) { return t.comment.replace(/^"/, '').replace(/"$/, '') === appName; })[0].value;
	var mainTarget = xobjs.PBXNativeTarget[mainTargetUuid];
	var mainGroupChildren = xobjs.PBXGroup[pbxProject.mainGroup].children;
	var generateUuid = this.builder.generateXcodeUuid.bind(this.builder, xcodeProject);

	var frameworksGroup = xobjs.PBXGroup[mainGroupChildren.filter(function (child) { return child.comment === 'Frameworks'; })[0].value];
	var frameworksBuildPhase = xobjs.PBXFrameworksBuildPhase[mainTarget.buildPhases.filter(function (phase) { return xobjs.PBXFrameworksBuildPhase[phase.value]; })[0].value];
	var frameworksToAdd = [];
	var alreadyAddedFrameworks = new Set();
	Object.keys(xobjs.PBXFrameworksBuildPhase).forEach(buildPhaseId => {
		if (xobjs.PBXFrameworksBuildPhase[buildPhaseId] && typeof xobjs.PBXFrameworksBuildPhase[buildPhaseId] === 'object') {
			xobjs.PBXFrameworksBuildPhase[buildPhaseId].files.forEach(file => {
				var frameworkPackageName = xobjs.PBXBuildFile[file.value].fileRef_comment;
				var frameworkName = frameworkPackageName.replace('.framework', '');
				alreadyAddedFrameworks.add(this.frameworks.get(frameworkName));
			});
		}
	});

	// Add all detected system frameworks
	this.usedFrameworks.forEach(frameworkMetadata => {
		if (this.systemFrameworks.has(frameworkMetadata.name)) {
			frameworksToAdd.push(frameworkMetadata);
		}
	}, this);

	// Add any additionally configured system frameworks from appc.js
	if (this.hyperloopConfig.ios.xcodebuild && Array.isArray(this.hyperloopConfig.ios.xcodebuild.frameworks)) {
		this.hyperloopConfig.ios.xcodebuild.frameworks.forEach(function (frameworkName) {
			if (typeof frameworkName !== 'string') {
				return;
			}
			if (this.systemFrameworks.has(frameworkName)) {
				frameworksToAdd.push(this.systemFrameworks.get(frameworkName));
			} else {
				this.logger.error(`Unable to link against non-existing system framework "${frameworkName}". Please check your appc.js configurtion.`);
				process.exit(1);
			}
		}, this);
	}

	frameworksToAdd.forEach(frameworkMetadata => {
		if (alreadyAddedFrameworks.has(frameworkMetadata)) {
			return;
		}
		alreadyAddedFrameworks.add(frameworkMetadata);

		var frameworkPackageName = `${frameworkMetadata.name}.framework`;
		var fileRefUuid = generateUuid();
		var buildFileUuid = generateUuid();

		// add the file reference
		xobjs.PBXFileReference[fileRefUuid] = {
			isa: 'PBXFileReference',
			lastKnownFileType: 'wrapper.framework',
			name: '"' + frameworkPackageName + '"',
			path: '"' + path.join('System', 'Library', 'Frameworks', frameworkPackageName) + '"',
			sourceTree: '"SDKROOT"'
		};
		xobjs.PBXFileReference[fileRefUuid + '_comment'] = frameworkPackageName;

		frameworksGroup.children.push({
			value: fileRefUuid,
			comment: frameworkPackageName
		});

		xobjs.PBXBuildFile[buildFileUuid] = {
			isa: 'PBXBuildFile',
			fileRef: fileRefUuid,
			fileRef_comment: frameworkPackageName
		};
		if (!frameworkMetadata.isAvailable(this.sdkInfo.minVersion)) {
			xobjs.PBXBuildFile[buildFileUuid].settings = { ATTRIBUTES: [ 'Weak' ] };
		}
		xobjs.PBXBuildFile[buildFileUuid + '_comment'] = frameworkPackageName + ' in Frameworks';

		frameworksBuildPhase.files.push({
			value: buildFileUuid,
			comment: frameworkPackageName + ' in Frameworks'
		});
	}, this);

	// create a Hyperloop group so that the code is nice and tidy in the Xcode project
	var hyperloopGroupUuid = (mainGroupChildren.filter(function (child) { return child.comment === 'Hyperloop'; })[0] || {}).value;
	var hyperloopGroup = hyperloopGroupUuid && xobjs.PBXGroup[hyperloopGroupUuid];
	if (!hyperloopGroup) {
		hyperloopGroupUuid = generateUuid();
		mainGroupChildren.push({
			value: hyperloopGroupUuid,
			comment: 'Hyperloop'
		});

		hyperloopGroup = {
			isa: 'PBXGroup',
			children: [],
			name: 'Hyperloop',
			sourceTree: '"<group>"'
		};

		xobjs.PBXGroup[hyperloopGroupUuid] = hyperloopGroup;
		xobjs.PBXGroup[hyperloopGroupUuid + '_comment'] = 'Hyperloop';
	}

	var swiftRegExp = /\.swift$/;
	var containsSwift = false;
	var groups = {};

	// add any source files we want to include in the compile
	if (this.hyperloopConfig.ios.thirdparty) {
		var objcRegExp = /\.mm?$/;
		Object.keys(this.hyperloopConfig.ios.thirdparty).forEach(function (framework) {
			var source = this.hyperloopConfig.ios.thirdparty[framework].source;
			if (!source) {
				return;
			}

			if (!Array.isArray(source)) {
				source = [ source ];
			}

			groups[framework] || (groups[framework] = {});

			source
				.map(function (src) {
					return path.join(projectDir, src);
				})
				.forEach(function walk(file) {
					if (fs.existsSync(file)) {
						if (fs.statSync(file).isDirectory()) {
							fs.readdirSync(file).forEach(function (name) {
								walk(path.join(file, name));
							});
						} else if (objcRegExp.test(file)) {
							groups[framework][file] = 1;
						} else if (swiftRegExp.test(file)) {
							containsSwift = true;
							groups[framework][file] = 1;
						}
					}
				});
		}, this);
	}

	// check CocoaPods and local third-party frameworks for swift usage
	if (!containsSwift) {
		containsSwift = Object.keys(this.cocoaPodsBuildSettings).some(function (key) {
			return key === 'EMBEDDED_CONTENT_CONTAINS_SWIFT';
		});
	}
	if (!containsSwift) {
		containsSwift = Array.from(this.thirdPartyFrameworks.values()).some(function (frameworkMeta) {
			return frameworkMeta.usesSwift === true;
		}, this);
	}
	// if we have any swift usage, enable swift support
	if (containsSwift) {
		Object.keys(xobjs.PBXNativeTarget).forEach(function (targetUuid) {
			var target = xobjs.PBXNativeTarget[targetUuid];
			if (target && typeof target === 'object') {
				xobjs.XCConfigurationList[target.buildConfigurationList].buildConfigurations.forEach(function (buildConf) {
					var buildSettings = xobjs.XCBuildConfiguration[buildConf.value].buildSettings;

					if (!buildSettings.SWIFT_VERSION) {
						buildSettings.SWIFT_VERSION = this.swiftVersion;
					}

					var embeddedContentMaximumSwiftVersion = '2.3';
					if (this.appc.version.lte(this.swiftVersion, embeddedContentMaximumSwiftVersion)) {
						buildSettings.EMBEDDED_CONTENT_CONTAINS_SWIFT = 'YES';
					} else {
						buildSettings.ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = 'YES';
					}

					// LD_RUNPATH_SEARCH_PATHS is a space separated string of paths
					var searchPaths = (buildSettings.LD_RUNPATH_SEARCH_PATHS || '').replace(/^"/, '').replace(/"$/, '');
					if (searchPaths.indexOf('$(inherited)') === -1) {
						searchPaths += ' $(inherited)';
					}
					if (searchPaths.indexOf('@executable_path/Frameworks') === -1) {
						searchPaths += ' @executable_path/Frameworks';
					}
					buildSettings.LD_RUNPATH_SEARCH_PATHS = '"' + searchPaths.trim() + '"';
				}, this);
			}
		}, this);
	}

	// add the source files to xcode to compile
	if (nativeModules.length) {
		groups['Native'] || (groups['Native'] = {});
		nativeModules.forEach(function (mod) {
			groups['Native'][mod] = 1;
		});
	}

	// check to see if we compiled a custom class and if so, we need to add it to the project
	var customClass = path.join(this.hyperloopJSDir, 'hyperloop', 'custom.m');
	if (fs.existsSync(customClass)) {
		groups['Custom'] || (groups['Custom'] = {});
		groups['Custom'][customClass] = 1;
	}

	var sourcesBuildPhase = xobjs.PBXSourcesBuildPhase[mainTarget.buildPhases.filter(function (phase) { return xobjs.PBXSourcesBuildPhase[phase.value]; })[0].value];

	// loop over the groups and the files in each group and add them to the Xcode project
	Object.keys(groups).forEach(function (groupName) {
		var groupUuid = generateUuid();

		hyperloopGroup.children.push({
			value: groupUuid,
			comment: groupName
		});

		var group = {
			isa: 'PBXGroup',
			children: [],
			name: '"' + groupName + '"',
			sourceTree: '"<group>"'
		};

		xobjs.PBXGroup[groupUuid] = group;
		xobjs.PBXGroup[groupUuid + '_comment'] = groupName;

		Object.keys(groups[groupName]).forEach(function (file) {
			var name = path.basename(file);
			var fileRefUuid = generateUuid();
			var buildFileUuid = generateUuid();
			var objcPlusPlusPattern = /\.mm$/;

			// add the file reference
			xobjs.PBXFileReference[fileRefUuid] = {
				isa: 'PBXFileReference',
				fileEncoding: 4,
				lastKnownFileType: 'sourcecode.' + (swiftRegExp.test(file) ? 'swift' : (objcPlusPlusPattern.test(file) ? 'cpp.objcpp' : 'c.objc')),
				name: '"' + name + '"',
				path: '"' + file + '"',
				sourceTree: '"<absolute>"'
			};
			xobjs.PBXFileReference[fileRefUuid + '_comment'] = name;

			// add the library to the Frameworks group
			group.children.push({
				value: fileRefUuid,
				comment: name
			});

			// add the build file
			xobjs.PBXBuildFile[buildFileUuid] = {
				isa: 'PBXBuildFile',
				fileRef: fileRefUuid,
				fileRef_comment: name,
				settings: { COMPILER_FLAGS: '"-fobjc-arc"' }
			};
			xobjs.PBXBuildFile[buildFileUuid + '_comment'] = name + ' in Sources';

			sourcesBuildPhase.files.push({
				value: buildFileUuid,
				comment: name + ' in Sources'
			});
		});
	});

	if (this.hasCocoaPods) {
		const frameworksScriptPath = path.join(
			this.builder.projectDir,
			'Pods',
			'Target Support Files',
			`Pods-${appName}`,
			`Pods-${appName}-frameworks.sh`
		);
		if (fs.existsSync(frameworksScriptPath)) {
			const embedPodsFrameworksBuildPhaseId = generateUuid();
			const embedPodsFrameworksBuildPhase = {
				isa: 'PBXShellScriptBuildPhase',
				buildActionMask: 2147483647,
				files: [],
				inputPaths: [],
				name: '"[CP] Embed Pods Frameworks"',
				outputPaths: [],
				runOnlyForDeploymentPostprocessing: 0,
				shellPath: '/bin/sh',
				shellScript: '"\\"${PODS_ROOT}/Target Support Files/Pods-' + appName + '/Pods-' + appName + '-frameworks.sh\\""',
				showEnvVarsInLog: 0
			};
			xobjs.PBXShellScriptBuildPhase[embedPodsFrameworksBuildPhaseId] = embedPodsFrameworksBuildPhase;
			mainTarget.buildPhases.push(embedPodsFrameworksBuildPhaseId);
		}

		const resourcesScriptPath = path.join(
			this.builder.projectDir,
			'Pods',
			'Target Support Files',
			`Pods-${appName}`,
			`Pods-${appName}-resources.sh`
		);
		if (fs.existsSync(resourcesScriptPath)) {
			var copyPodsResourcesBuildPhaseId = generateUuid();
			var copyPodsResourcesBuildPhase = {
				isa: 'PBXShellScriptBuildPhase',
				buildActionMask: 2147483647,
				files: [],
				inputPaths: [],
				name: '"[CP] Copy Pods Resources"',
				outputPaths: [],
				runOnlyForDeploymentPostprocessing: 0,
				shellPath: '/bin/sh',
				shellScript: '"\\"${PODS_ROOT}/Target Support Files/Pods-' + appName + '/Pods-' + appName + '-resources.sh\\""',
				showEnvVarsInLog: 0
			};
			xobjs.PBXShellScriptBuildPhase[copyPodsResourcesBuildPhaseId] = copyPodsResourcesBuildPhase;
			mainTarget.buildPhases.push(copyPodsResourcesBuildPhaseId);
		}
	}

	if (this.hasCustomShellScriptBuildPhases()) {
		this.hyperloopConfig.ios.xcodebuild.scripts.forEach(function (buildPhaseOptions) {
			if (!buildPhaseOptions.name || !buildPhaseOptions.shellScript) {
				throw new Error('Your appc.js contains an invalid shell script build phase. Please specify at least a "name" and the "shellScript" to run.');
			}
			var scriptBuildPhaseId = generateUuid();
			var scriptBuildPhase = {
				isa: 'PBXShellScriptBuildPhase',
				buildActionMask: 2147483647,
				files: [],
				inputPaths: buildPhaseOptions.inputPaths || [],
				name: '"' + buildPhaseOptions.name + '"',
				outputPaths: buildPhaseOptions.outputPaths || [],
				runOnlyForDeploymentPostprocessing: buildPhaseOptions.runOnlyWhenInstalling ? 1 : 0,
				shellPath: buildPhaseOptions.shellPath || '/bin/sh',
				shellScript: '"' + buildPhaseOptions.shellScript.replace(/"/g, '\\"') + '"',
				showEnvVarsInLog: buildPhaseOptions.showEnvVarsInLog ? 1 : 0
			};
			xobjs.PBXShellScriptBuildPhase[scriptBuildPhaseId] = scriptBuildPhase;
			mainTarget.buildPhases.push(scriptBuildPhaseId);
		});
	}

	var contents = xcodeProject.writeSync(),
		dest = xcodeProject.filepath,
		parent = path.dirname(dest),
		i18n = this.appc.i18n(__dirname),
		__ = i18n.__;

	if (!fs.existsSync(dest) || contents !== fs.readFileSync(dest).toString()) {
		if (!this.forceRebuild) {
			this.logger.info(__('Forcing rebuild: Xcode project has changed since last build'));
			this.forceRebuild = true;
		}
		this.logger.debug(__('Writing %s', dest.cyan));
		fs.ensureDirSync(parent);
		fs.writeFileSync(dest, contents);
	} else {
		this.logger.trace(__('No change, skipping %s', dest.cyan));
	}

};

/**
 * Checks wether the config in appc.json contains custom shell script build phases
 * that should be added to the Xcode project
 *
 * @return {Boolean} True if shell script build phases are defined, false if not
 */
HyperloopiOSBuilder.prototype.hasCustomShellScriptBuildPhases = function hasCustomShellScriptBuildPhases() {
	var config = this.hyperloopConfig;
	return config.ios && config.ios.xcodebuild && config.ios.xcodebuild.scripts;
};

/**
 * Displays migration instructions for certain methods that changed with iOS 10
 * and Hyperloop 2.0.0
 *
 * Can be removed in a later version of Hyperloop
 */
HyperloopiOSBuilder.prototype.displayMigrationInstructions = function displayMigrationInstructions() {
	var that = this;

	if (Object.keys(this.needMigration).length === 0) {
		return;
	}

	that.logger.error('');
	that.logger.error('!!! CODE MIGRATION REQUIRED !!!');
	that.logger.error('');
	that.logger.error('Due to changes introduced in iOS 10 and Hyperloop 2.0.0 some method calls need');
	that.logger.error('to be changed to property access. It seems like you used some of the affected');
	that.logger.error('methods.');
	that.logger.error('');
	that.logger.error('We tried to fix most of these automatically during compile time. However, we did');
	that.logger.error('not touch your original source files. Please see the list below to help you');
	that.logger.error('migrate your code.');
	that.logger.error('');
	that.logger.error('NOTE: Some line numbers and file names shown here are from your compiled Alloy');
	that.logger.error('source code and may differ from your original source code.');

	Object.keys(this.needMigration).forEach(function (pathAndFilename) {
		var tokens = that.needMigration[pathAndFilename];
		var relativePathAndFilename = pathAndFilename.replace(that.resourcesDir, 'Resources').replace(/^Resources\/iphone\/alloy\//, 'app/');
		that.logger.error('');
		that.logger.error('  File: ' + relativePathAndFilename);
		tokens.forEach(function (token) {
			var memberExpression = token.objectName + '.' + token.methodName;
			var callExpression = memberExpression + '()';
			that.logger.error('    Line ' + token.line + ': ' + callExpression + ' -> ' + memberExpression);
		});
	});

	that.logger.error('');
};

/**
 * Clean up unwanted files.
 * @param {Object} data - The hook payload.
 */
HyperloopiOSBuilder.prototype.hookRemoveFiles = function hookRemoveFiles(data) {
	// remove empty Framework directory that might have been created by cocoapods
	var frameworksDir = path.join(this.builder.xcodeAppDir, 'Frameworks');
	if (fs.existsSync(frameworksDir) && fs.readdirSync(frameworksDir).length === 0) {
		fs.removeSync(frameworksDir);
	}
	if (this.hasCocoaPods) {
		var productsDirectory = path.resolve(this.builder.xcodeAppDir, '..');
		this.cocoaPodsProducts.forEach(function (product) {
			this.builder.unmarkBuildDirFiles(path.join(productsDirectory, product));
		}.bind(this));
	}
};

/**
 * Inject additional parameters into the xcodebuild arguments.
 * @param {Object} data - The hook payload.
 */
HyperloopiOSBuilder.prototype.hookXcodebuild = function hookXcodebuild(data) {
	var args = data.args[1];
	var quotesRegExp = /^"(.*)"$/;
	var substrRegExp = /(?:[^\s"]+|"[^"]*")+/g;

	function splitValue(value) {
		var part,
			parts = [];
		while ((part = substrRegExp.exec(value)) !== null) {
			parts.push(part[0].replace(quotesRegExp, '$1'));
		}
		return parts;
	}

	function mixValues(dest, src) {
		dest = splitValue(dest.replace(quotesRegExp, '$1'));

		splitValue(src).forEach(function (value) {
			if (dest.indexOf(value) === -1) {
				dest.push(value);
			}
		});

		return dest.map(function (value) {
			value = String(value);
			return value.indexOf(' ') !== -1 && !quotesRegExp.test(value) ? ('"' + value.replace(/(\\)?"/g, '\\"') + '"') : value;
		}).join(' ');
	}

	function addParam(key, value) {
		if (key === 'OTHER_LDFLAGS') {
			// Rewrite other linker flags to the special Hyperloop linker flags to
			// make sure they will only be passed to iPhone device and sim builds
			key = 'HYPERLOOP_LDFLAGS';
		}

		for (var i = 0; i < args.length; i++) {
			if (args[i].indexOf(key + '=') === 0) {
				// already exists
				args[i] = key + '=' + mixValues(args[i].substring(args[i].indexOf('=') + 1), value);
				return;
			}
		}

		// add it
		args.push(key + '=' + value);
	}

	// speed up the build by only building the target architecture
	if (this.builder.deployType === 'development' && this.builder.target === 'simulator') {
		addParam('ONLY_ACTIVE_ARCH', 1);
		addParam('EXCLUDED_ARCHS', 'arm64 i386'); // only build for x86_64!
	}

	// add any compiler specific flags
	if (this.hyperloopConfig.ios.xcodebuild && this.hyperloopConfig.ios.xcodebuild.flags) {
		Object.keys(this.hyperloopConfig.ios.xcodebuild.flags).forEach(function (key) {
			addParam(key, this.hyperloopConfig.ios.xcodebuild.flags[key]);
		}, this);
	}

	// add any build settings from the generate CocoaPods phase
	this.cocoaPodsBuildSettings && Object.keys(this.cocoaPodsBuildSettings).forEach(function (key) {
		addParam(key, this.cocoaPodsBuildSettings[key]);
	}, this);

	// add our header include paths if we have custom ones
	if (this.headers) {
		addParam('HEADER_SEARCH_PATHS', '$(inherited)');
		addParam('FRAMEWORK_SEARCH_PATHS', '$(inherited)');
		this.headers.forEach(function (header) {
			addParam('HEADER_SEARCH_PATHS', header);
			addParam('FRAMEWORK_SEARCH_PATHS', header);
		});
	}

	addParam('APPC_PROJECT_DIR', this.builder.projectDir);
};

/**
 * Special marker error to stop Hyperloop compile if no usage found
 */
class StopHyperloopCompileError extends Error {

}

/**
 * Computes the soundex for a string.
 * https://github.com/LouisT/node-soundex/blob/master/index.js
 * @param {String} str - The string to analyze.
 * @param {Boolean} [scale=false] - If true, a Higgs boson is created.
 * @returns {String}
 */
function soundEx(str, scale) {
	var split = String(str).toUpperCase().replace(/[^A-Z]/g, '').split(''),
		map = {
			BFPV: 1,
			CGJKQSXZ: 2,
			DT: 3,
			L: 4,
			MN: 5,
			R: 6
		},
		keys = Object.keys(map).reverse();

	var build = split.map(function (letter) {
		for (var num in keys) {
			if (keys[num].indexOf(letter) != -1) {
				return map[keys[num]];
			}
		}
	});
	var first = build.shift();

	build = build.filter(function (num, index, array) {
		return ((index === 0) ? num !== first : num !== array[index - 1]);
	});

	var len = build.length,
		max = (scale ? ((max = ~~((len * 2 / 3.5))) > 3 ? max : 3) : 3);

	return split[0] + (build.join('') + (new Array(max + 1).join('0'))).slice(0, max);
}

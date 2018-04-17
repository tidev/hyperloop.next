/**
 * Hyperloop ®
 * Copyright (c) 2015-2018 by Appcelerator, Inc.
 * All Rights Reserved. This library contains intellectual
 * property protected by patents and/or patents pending.
 */

'use strict';

module.exports = HyperloopiOSBuilder;

// set this to enforce a ios-min-version
const IOS_MIN = '8.0';
// set this to enforce a minimum Titanium SDK
const TI_MIN = '7.0.0';
// Min SDK to use the newer build.ios.compileJsFile hook
const COMPILE_JS_FILE_HOOK_SDK_MIN = '7.1.0';
// set the iOS SDK minium
const IOS_SDK_MIN = '9.0';
// enum for ios javascript core
const coreLib = {
	JSCore: 'libhyperloop-jscore.a',
	TiCore: 'libhyperloop-ticore.a'
};

const path = require('path');
const hm = require('hyperloop-metabase');
const SDKEnvironment = hm.SDKEnvironment;
const fs = require('fs-extra');
const crypto = require('crypto');
const chalk = require('chalk');
const async = require('async');
const HL = chalk.magenta.inverse('Hyperloop');
const StopHyperloopCompileError = require('./lib/error').StopHyperloopCompileError;

const generator = require('./generate');
const util = require('./lib/util');
const ScanReferencesTask = require('./tasks/scan-references-task');
const GenerateMetabaseTask = require('./tasks/generate-metabase-task');
const GenerateSourcesTask = require('./tasks/generate-sources-task');
const CopySourcesTask = require('./tasks/copy-sources-task');

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
	this.userFrameworks = new Map();
	this.thirdPartyFrameworks = new Map();
	this.includes = [];
	this.swiftVersion = '3.0';
	this.jsFiles = {};
	this.references = {};
	this.usedFrameworks = new Map();
	this.metabase = {};
	this.hasCocoaPods = false;
	this.cocoaPodsBuildSettings = {};
	this.cocoaPodsProducts = [];
	this.headers = []; // headers from third party frameworks!
	this.needMigration = {};
	this.useCopyResourceHook = false; // boolean flag to determine which CLi hook to use based on SDK version

	// set our CLI logger
	hm.setLogger(builder.logger);
}

/**
 * called for each resource to process them
 * @param {Object} builder builder
 * @param {Array} builder.args arguments to hook
 * @param {Function} callback callback function
 * @returns {void}
 */
HyperloopiOSBuilder.prototype.copyResource = function (builder, callback) {
	try {
		// Use this variant of the hook on SDK 7.0.2 and lower
		if (!this.useCopyResourceHook) {
			return callback();
		}
		const from = builder.args[0];
		const to = builder.args[1];
		const contents = fs.readFileSync(to).toString();
		const obj = {
			contents: contents,
			original: contents
		};

		this.patchJSFile(obj, from, to, function (err) {
			if (err) {
				return callback(err);
			}

			// Only write if contents changed
			if (contents !== obj.contents) {
				fs.writeFile(to, obj.contents, callback);
			} else {
				callback();
			}
		});
	} catch (e) {
		callback(e);
	}
};

/**
 * called for each JS resource to process them
 * @param {Object} builder builder
 * @param {Array} builder.args arguments to hook
 * @param {Function} callback callback function
 * @returns {void}
 */
HyperloopiOSBuilder.prototype.compileJsFile = function (builder, callback) {
	try {
		// use this variant of the hook on SDK 7.1+
		if (this.useCopyResourceHook) {
			return callback();
		}
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
		// TODO Most of these could be run in parallel! I think we need to get sdk info to get system frameworks.
		// But we should be able to get swift version in parallel to that, same with cocoapods, third party frameworks
		'getSDKInfo',
		'detectSwiftVersion',
		// Here we gather up the various frameworks the user could refer to.
		'getSystemFrameworks',
		'generateCocoaPods',
		'processThirdPartyFrameworks'
	], callback);
};

HyperloopiOSBuilder.prototype.run = function run(builder, callback) {
	const start = Date.now();
	this.logger.info(`Starting ${HL} assembly`);
	this.appc.async.series(this, [
		'generateMetabase',
		'generateSymbolReference',
		'compileResources',
		'generateStubs',
		'copyHyperloopJSFiles',
		'updateXcodeProject'
	], function (err) {
		if (err instanceof StopHyperloopCompileError) {
			err = null;
		}
		this.logger.info(`Finished ${HL} assembly in ${(Math.round((Date.now() - start) / 10) / 100)} seconds`);
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
		const pkg = require('./package.json');
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

	if (!this.appc.version.gte(this.builder.titaniumSdkVersion, COMPILE_JS_FILE_HOOK_SDK_MIN)) {
		this.useCopyResourceHook = true;
	}

	// update to use the correct libhyperloop based on which JS engine is configured
	this.builder.nativeLibModules.some(function (mod) {
		if (mod.id !== 'hyperloop') {
			return false;
		}
		const JSCoreFlag = this.builder.tiapp.ios['use-jscore-framework'];
		const usesJSCore = JSCoreFlag === undefined || JSCoreFlag === true;

		// check for built-in JSCore but only warn if not set
		if (!usesJSCore) {
			this.logger.info('The Hyperloop compiler works best with the built-in iOS JavaScriptCore library.');
			this.logger.info('In Titanium SDK 7.0.0+, the built-in JavaScriptCore library is used by default.');
			this.logger.info('Either remove the following flag or explicitly enable it to use the recommended settings:');
			this.logger.info('');
			this.logger.info('	<use-jscore-framework>true</use-jscore-framework>');
			this.logger.info('');
			mod.libName = coreLib.TiCore;
		} else {
			mod.libName = coreLib.JSCore;
		}
		mod.libFile = path.join(mod.modulePath, mod.libName);
		mod.hash = crypto.createHash('md5').update(fs.readFileSync(mod.libFile)).digest('hex');
		this.logger.debug('Using Hyperloop library -> ' + mod.libName);
		return true;
	}, this);
};

/**
 * Gets the iOS SDK info (this.sdkInfo). Really we're just grabbing the sdk path
 * given the target os type we already have (builder.xcodeTargetOS), and setting
 * the sdkInfo.minVersion from builder.minIosVer
 * @param {Function} callback typical callback function
 */
HyperloopiOSBuilder.prototype.getSDKInfo = function getSDKInfo(callback) {
	SDKEnvironment.fromTypeAndMinimumVersion(this.builder.xcodeTargetOS, this.builder.minIosVer)
		.then(info => {
			this.sdkInfo = info;
			callback();
		})
		.catch(err => callback(err));
};

/**
 * Gets the system frameworks from the Hyperloop Metabase.
 * @param {Function} callback typical callback function
 */
HyperloopiOSBuilder.prototype.getSystemFrameworks = function getSystemFrameworks(callback) {
	this.sdkInfo.getSystemFrameworks()
		.then(systemFrameworks => {
			this.systemFrameworks = new Map(systemFrameworks); // copy the map

			this.systemFrameworks.forEach(frameworkMetadata => {
				this.frameworks.set(frameworkMetadata.name, frameworkMetadata);
			});
			callback();
		})
		.catch(err => callback(err));
};

/**
 * Has the Hyperloop Metabase generate the CocoaPods and then adds the symbols to the map of frameworks.
 * @param {Function} callback typical async callback function
 * @return {void}
 */
HyperloopiOSBuilder.prototype.generateCocoaPods = function generateCocoaPods(callback) {
	hm.cocoapods.installPodsAndGetSettings(this.builder)
		.then(settings => {
			this.cocoaPodsBuildSettings = settings || {};
			return hm.cocoapods.generateCocoaPodsMetadata(this.builder, settings);
		})
		.then(modules => {
			this.hasCocoaPods = modules && modules.size > 0;
			if (this.hasCocoaPods) {
				modules.forEach(metadata => {
					this.frameworks.set(metadata.name, metadata);
					this.cocoaPodsProducts.push(metadata.name);
				});
			}
			callback();
		})
		.catch(err => callback(err));
};

/**
 * Gets frameworks for any third-party dependencies defined in the Hyperloop config and compiles them.
 * @param {Function} callback typical async callback function
 * @return {void}
 */
// TODO: Break this apart into two distinct methods?
// processPlatformIosframeworks
// processAppcJsThirdPartyFrameworks (deprecated)
HyperloopiOSBuilder.prototype.processThirdPartyFrameworks = function processThirdPartyFrameworks(callback) {
	const frameworks = this.frameworks;
	const userFrameworks = this.userFrameworks;
	const thirdPartyFrameworks = this.thirdPartyFrameworks;
	const thirdparty = this.hyperloopConfig.ios.thirdparty || [];
	const projectDir = this.builder.projectDir;
	const builder = this.builder;
	const logger = this.logger;
	let headers = this.headers;

	/**
	 * Processes any frameworks from modules or the app's platform/ios folder
	 *
	 * @param {Function} next Callback function
	 * @return {void}
	 */
	function processFrameworks(next) {
		if (!builder.frameworks || Object.keys(builder.frameworks).length === 0) {
			return next();
		}

		hm.userFrameworks(builder.frameworks)
			.then(modules => {
				modules.forEach(moduleMetadata => {
					userFrameworks.set(moduleMetadata.name, moduleMetadata);
					frameworks.set(moduleMetadata.name, moduleMetadata);
				});
				next();
			})
			.catch(err => next(err));
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
		if (thirdparty.length > 0) {
			// Throw a deprecation warning regarding thirdparty-references in the appc.js
			logger.warn('Defining third-party sources and frameworks in appc.js via the \'thirdparty\' section has been deprecated in Hyperloop 2.2.0 and will be removed in 4.0.0. The preferred way to provide third-party sources is either via dropping frameworks into the project\'s platform/ios folder or by using CocoaPods.');
		}

		hm.thirdPartyFrameworks(projectDir, thirdparty)
			.then(modules => {
				modules.forEach(moduleMetadata => {
					// Combine all the headers into this.headers!
					const frameworkHeaders = moduleMetadata.getHeaders();
					headers = headers.concat(frameworkHeaders);
					thirdPartyFrameworks.set(moduleMetadata.name, moduleMetadata);
					frameworks.set(moduleMetadata.name, moduleMetadata);
				});
				next();
			})
			.catch(err => next(err));
	}

	async.series([
		processFrameworks,
		processConfiguredThirdPartySource
	], callback);
};

/**
 * Detects the configured swift version
 * @param {Function} callback typical async callback function
 * @return {void}
 */
HyperloopiOSBuilder.prototype.detectSwiftVersion = function detectSwiftVersion(callback) {
	hm.swift.getVersion()
		.then(version => {
			this.swiftVersion = version;
			callback();
		})
		.catch(err => callback(err));
};

/**
 * Re-write generated JS source
 * @param {Object} obj - JS object holding data about the file
 * @param {String} obj.contents - current source code for the file
 * @param {String} obj.original - original source of the file
 * @param {String} sourceFilename - path to original JS file
 * @param {String} destinationFilename - path to destination JS file
 * @param {Function} cb - callback function
 * @returns {void}
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

	const result = ScanReferencesTask.scanForReferences(contents, sourceFilename, this.frameworks, this.hyperloopBuildDir, this.sdkInfo, this.logger);
	// Do something with references! Loop through and gather list of used frameworks and types!
	result.references.forEach((types, frameworkName) => {
		types.forEach(type => {
			this.references[`/hyperloop/${frameworkName.toLowerCase()}/${type.toLowerCase()}`] = 1;
		});
		if (!this.usedFrameworks.has(frameworkName) && !util.isBuiltin(frameworkName)) {
			this.usedFrameworks.set(frameworkName, this.frameworks.get(frameworkName));
		}
	});

	let newContents = result.replacedContent;

	// TODO: Remove once we combine the custom acorn-based parser and the babylon parser above!
	// Or maybe it can go now? The migration stuff is noted that it could be removed in 3.0.0...
	const needMigration = this.parserState.state.needMigration;
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
 * Generates a unified metabase from the required frameworks, custom swift sources,
 * thirdparty references in appc.js
 * @param {Function} callback typical async callback function
 * @return {void}
 */
HyperloopiOSBuilder.prototype.generateMetabase = function generateMetabase(callback) {
	// no hyperloop files detected, we can stop here
	if (!this.includes.length && !Object.keys(this.references).length) {
		this.logger.info(`Skipping ${HL} compile, no usage found ...`);
		return callback(new StopHyperloopCompileError());
	}

	const frameworksUsed = Array.from(this.usedFrameworks.keys());

	GenerateMetabaseTask.generateMetabase(
		this.sdkInfo,
		this.frameworks,
		frameworksUsed)
		.then(metabase => {
			this.metabase = metabase;
			callback();
		})
		.catch(err => callback(err));
};

/**
 * Generates the symbol reference based on the references from the metabase's parser state.
 * This is used as a sort of check to see if we need to re-generate JS stubs.
 * We check for an existing file with the same contents. If not, we force stub generation.
 */
HyperloopiOSBuilder.prototype.generateSymbolReference = function generateSymbolReference() {

	if (!this.parserState) {
		this.logger.info(`Skipping ${HL} generating of symbol references. Empty AST.`);
		return;
	}
	const symbolRefFile = path.join(this.hyperloopBuildDir, 'symbol_references.json'),
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
 * @param {Function} callback typical async callback function
 * @return {void}
 */
HyperloopiOSBuilder.prototype.compileResources = function compileResources(callback) {
	const promises = [];
	// compile 3rd-party framework resources
	this.thirdPartyFrameworks.forEach(framework => {
		promises.push(framework.compileResources(this.builder.xcodeTargetOS, this.builder.iosSdkVersion, this.builder.xcodeAppDir));
	});
	// compile project resources
	const sdk = this.builder.xcodeTargetOS + this.builder.iosSdkVersion;
	promises.push(hm.resources.compileResources(this.resourcesDir, sdk, this.builder.xcodeAppDir, false));
	Promise.all(promises)
		.then(() => callback())
		.catch(err => callback(err));
};

/**
 * Generates JS stubs from the metabase.
 * @param {Function} callback typical async callback function
 * @return {void}
 */
HyperloopiOSBuilder.prototype.generateStubs = function generateStubs(callback) {
	if (!this.parserState) {
		this.logger.info(`Skipping ${HL} stub generation. Empty AST.`);
		return callback();
	}
	if (!this.forceStubGeneration) {
		this.logger.debug('Skipping stub generation');
		return callback();
	}

	fs.ensureDirSync(this.hyperloopJSDir);
	GenerateSourcesTask.generateSources(this.hyperloopJSDir, this.builder.tiapp.name, this.metabase, this.parserState, this.frameworks, this.references, this.logger, callback);
};

/**
 * Copies Hyperloop generated JavaScript files into the app's `Resources/hyperloop` directory.
 */
HyperloopiOSBuilder.prototype.copyHyperloopJSFiles = function copyHyperloopJSFiles() {
	const keys = Object.keys(this.references);

	// only if we found references, otherwise, skip
	if (!keys.length) {
		return;
	}

	CopySourcesTask.copy(this.hyperloopJSDir, this.hyperloopResourcesDir);
};

/**
 * Wire up the build hooks.
 */
HyperloopiOSBuilder.prototype.wireupBuildHooks = function wireupBuildHooks() {
	this.cli.on('build.ios.xcodeproject', {
		pre: this.hookUpdateXcodeProject.bind(this)
	});

	// To be removed once we no longer support SDK < 7.1
	this.cli.on('build.ios.copyResource', {
		post: this.copyResource.bind(this)
	});

	// For SDK 7.1+
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
	this.logger.info('updateXcodeProject');
	const data = this.xcodeprojectdata;

	// if we found references gather up "native modules"
	const keys = Object.keys(this.references);
	const nativeModules = new Set();
	if (keys.length) {
		// check to see if we have any specific file native modules and copy them in
		keys.forEach(ref => {
			const file = path.join(this.hyperloopJSDir, ref.replace(/^hyperloop\//, '') + '.m');
			if (fs.existsSync(file)) {
				nativeModules.add(file);
			}
		});

		// check to see if we have any package modules and copy them in
		this.usedFrameworks.forEach(frameworkMetadata => {
			const file = path.join(this.hyperloopJSDir, frameworkMetadata.name.toLowerCase() + '/' + frameworkMetadata.name.toLowerCase() + '.m');
			if (fs.existsSync(file)) {
				nativeModules.add(file);
			}
		});
	}

	// third party libraries won't have an entry in native modules so we explicitly
	// check for those here
	let thirdPartyFrameworksUsed = false;
	if (this.hyperloopConfig.ios.thirdparty) {
		const usedFrameworkNames = Array.from(this.usedFrameworks.keys());
		thirdPartyFrameworksUsed = Object.keys(this.hyperloopConfig.ios.thirdparty).some(function (thirdPartyFramework) {
			return usedFrameworkNames.some(function (usedFrameworkName) {
				return usedFrameworkName === thirdPartyFramework;
			}, this);
		}, this);
	}
	if (this.userFrameworks.size > 0) {
		thirdPartyFrameworksUsed = true;
	}

	if (!nativeModules.size && !thirdPartyFrameworksUsed) {
		return;
	}

	const projectDir = this.builder.projectDir;
	const appName = this.builder.tiapp.name;
	const xcodeProject = data.args[0];
	const xobjs = xcodeProject.hash.project.objects;
	const projectUuid = xcodeProject.hash.project.rootObject;
	const pbxProject = xobjs.PBXProject[projectUuid];
	const mainTargetUuid = pbxProject.targets.filter(t => {
		return t.comment.replace(/^"/, '').replace(/"$/, '') === appName;
	})[0].value;
	const mainTarget = xobjs.PBXNativeTarget[mainTargetUuid];
	const mainGroupChildren = xobjs.PBXGroup[pbxProject.mainGroup].children;
	const generateUuid = this.builder.generateXcodeUuid.bind(this.builder, xcodeProject);

	const frameworksGroup = xobjs.PBXGroup[mainGroupChildren.filter(child => {
		return child.comment === 'Frameworks';
	})[0].value];
	const frameworksBuildPhase = xobjs.PBXFrameworksBuildPhase[mainTarget.buildPhases.filter(phase => {
		return xobjs.PBXFrameworksBuildPhase[phase.value];
	})[0].value];
	const frameworksToAdd = [];
	const alreadyAddedFrameworks = new Set();
	Object.keys(xobjs.PBXFrameworksBuildPhase).forEach(buildPhaseId => {
		if (xobjs.PBXFrameworksBuildPhase[buildPhaseId] && typeof xobjs.PBXFrameworksBuildPhase[buildPhaseId] === 'object') {
			xobjs.PBXFrameworksBuildPhase[buildPhaseId].files.forEach(file => {
				const frameworkPackageName = xobjs.PBXBuildFile[file.value].fileRef_comment;
				const frameworkName = frameworkPackageName.replace('.framework', '');
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

		const frameworkPackageName = `${frameworkMetadata.name}.framework`;
		const fileRefUuid = generateUuid();
		const buildFileUuid = generateUuid();

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
	let hyperloopGroupUuid = (mainGroupChildren.filter(child => {
		return child.comment === 'Hyperloop';
	})[0] || {}).value;
	let hyperloopGroup = hyperloopGroupUuid && xobjs.PBXGroup[hyperloopGroupUuid];
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

	const swiftRegExp = /\.swift$/;
	let containsSwift = false;
	const groups = {};

	// add any source files we want to include in the compile
	if (this.hyperloopConfig.ios.thirdparty) {
		const objcRegExp = /\.mm?$/;
		Object.keys(this.hyperloopConfig.ios.thirdparty).forEach(function (framework) {
			let source = this.hyperloopConfig.ios.thirdparty[framework].source;
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
		containsSwift = Array.from(this.userFrameworks.values()).some(function (frameworkMeta) {
			return frameworkMeta.usesSwift === true;
		}, this);
	}
	if (!containsSwift) {
		containsSwift = Array.from(this.thirdPartyFrameworks.values()).some(function (frameworkMeta) {
			return frameworkMeta.usesSwift === true;
		}, this);
	}
	// if we have any swift usage, enable swift support
	if (containsSwift) {
		Object.keys(xobjs.PBXNativeTarget).forEach(function (targetUuid) {
			const target = xobjs.PBXNativeTarget[targetUuid];
			if (target && typeof target === 'object') {
				xobjs.XCConfigurationList[target.buildConfigurationList].buildConfigurations.forEach(function (buildConf) {
					const buildSettings = xobjs.XCBuildConfiguration[buildConf.value].buildSettings;

					if (!buildSettings.SWIFT_VERSION) {
						buildSettings.SWIFT_VERSION = this.swiftVersion;
					}

					const embeddedContentMaximumSwiftVersion = '2.3';
					if (this.appc.version.lte(this.swiftVersion, embeddedContentMaximumSwiftVersion)) {
						buildSettings.EMBEDDED_CONTENT_CONTAINS_SWIFT = 'YES';
					} else {
						buildSettings.ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = 'YES';
					}

					// LD_RUNPATH_SEARCH_PATHS is a space separated string of paths
					let searchPaths = (buildSettings.LD_RUNPATH_SEARCH_PATHS || '').replace(/^"/, '').replace(/"$/, '');
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
	if (nativeModules.size) {
		groups['Native'] || (groups['Native'] = {});
		nativeModules.forEach(function (mod) {
			groups['Native'][mod] = 1;
		});
	}

	// check to see if we compiled a custom class and if so, we need to add it to the project
	const customClass = path.join(this.hyperloopJSDir, 'hyperloop', 'custom.m');
	if (fs.existsSync(customClass)) {
		groups['Custom'] || (groups['Custom'] = {});
		groups['Custom'][customClass] = 1;
	}

	const sourcesBuildPhase = xobjs.PBXSourcesBuildPhase[mainTarget.buildPhases.filter(phase => {
		return xobjs.PBXSourcesBuildPhase[phase.value];
	})[0].value];

	// loop over the groups and the files in each group and add them to the Xcode project
	Object.keys(groups).forEach(function (groupName) {
		const groupUuid = generateUuid();

		hyperloopGroup.children.push({
			value: groupUuid,
			comment: groupName
		});

		const group = {
			isa: 'PBXGroup',
			children: [],
			name: '"' + groupName + '"',
			sourceTree: '"<group>"'
		};

		xobjs.PBXGroup[groupUuid] = group;
		xobjs.PBXGroup[groupUuid + '_comment'] = groupName;

		Object.keys(groups[groupName]).forEach(function (file) {
			const name = path.basename(file);
			const fileRefUuid = generateUuid();
			const buildFileUuid = generateUuid();

			// add the file reference
			xobjs.PBXFileReference[fileRefUuid] = {
				isa: 'PBXFileReference',
				fileEncoding: 4,
				lastKnownFileType: 'sourcecode.' + (swiftRegExp.test(file) ? 'swift' : 'c.objc'),
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

		const copyPodsResourcesBuildPhaseId = generateUuid();
		const copyPodsResourcesBuildPhase = {
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

	if (this.hasCustomShellScriptBuildPhases()) {
		this.hyperloopConfig.ios.xcodebuild.scripts.forEach(function (buildPhaseOptions) {
			if (!buildPhaseOptions.name || !buildPhaseOptions.shellScript) {
				throw new Error('Your appc.js contains an invalid shell script build phase. Please specify at least a "name" and the "shellScript" to run.');
			}
			const scriptBuildPhaseId = generateUuid();
			const scriptBuildPhase = {
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

	const contents = xcodeProject.writeSync(),
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
	const config = this.hyperloopConfig;
	return config.ios && config.ios.xcodebuild && config.ios.xcodebuild.scripts;
};

/**
 * Displays migration instructions for certain methods that changed with iOS 10
 * and Hyperloop 2.0.0
 *
 * Can be removed in a later version of Hyperloop
 */
HyperloopiOSBuilder.prototype.displayMigrationInstructions = function displayMigrationInstructions() {
	const that = this;

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
 */
HyperloopiOSBuilder.prototype.hookRemoveFiles = function hookRemoveFiles() {
	// remove empty Framework directory that might have been created by cocoapods
	const frameworksDir = path.join(this.builder.xcodeAppDir, 'Frameworks');
	if (fs.existsSync(frameworksDir) && fs.readdirSync(frameworksDir).length === 0) {
		fs.removeSync(frameworksDir);
	}
	if (this.hasCocoaPods) {
		const productsDirectory = path.resolve(this.builder.xcodeAppDir, '..');
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
	const args = data.args[1];
	const quotesRegExp = /^"(.*)"$/;
	const substrRegExp = /(?:[^\s"]+|"[^"]*")+/g;

	function splitValue(value) {
		let part;
		const parts = [];
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
	if (this.headers.length > 0) {
		addParam('HEADER_SEARCH_PATHS', '$(inherited)');
		addParam('FRAMEWORK_SEARCH_PATHS', '$(inherited)');
		this.headers.forEach(function (header) {
			addParam('HEADER_SEARCH_PATHS', header);
			addParam('FRAMEWORK_SEARCH_PATHS', header);
		});
		// FIXME: For some reason, when using ticore and having custom headers, the original header search path goes missing.
		if (!this.builder.tiapp.ios['use-jscore-framework']) {
			addParam('HEADER_SEARCH_PATHS', 'headers');
		}
	}

	addParam('GCC_PREPROCESSOR_DEFINITIONS', '$(inherited) HYPERLOOP=1');
	addParam('APPC_PROJECT_DIR', this.builder.projectDir);
};

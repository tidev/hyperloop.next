'use strict';

const path = require('path'),
	fs = require('fs-extra'),
	async = require('async'),
	util = require('./util'),
	os = require('os');
const ModuleMetadata = require('./module_metadata').ModuleMetadata;
const cache = require('./cache');

/**
 * ~/.hyperloop - used to cache system framework mappings/metabases.
 * @type {string}
 */
const USER_HOME_HYPERLOOP = path.join(os.homedir(), '.hyperloop');

/**
* @callback frameworkMapCallback
* @param {Error} err
* @param {Map<string, ModuleMetadata>} frameworks
*/

/**
 * return the system frameworks mappings as JSON for a given sdkType and minVersion
 * @param {String} sdkPath path to specific SDK we'll sniff for frameworks
 * @param {frameworkMapCallback} callback callback function
 * @returns {void}
 */
function getSystemFrameworks(sdkPath, callback) {
	const cacheToken = util.createHashFromString(sdkPath);
	const cacheFilename = path.join(USER_HOME_HYPERLOOP, 'metabase-mappings-' + cacheToken + '.json');
	if (!fs.existsSync(USER_HOME_HYPERLOOP)) {
		fs.ensureDirSync(USER_HOME_HYPERLOOP);
	} else {
		const cachedMetadata = cache.readModulesMetadataFromCache(cacheFilename);
		if (cachedMetadata !== null) {
			return callback(null, cachedMetadata);
		}
	}

	const frameworksPath = path.resolve(path.join(sdkPath, 'System/Library/Frameworks'));
	detectFrameworks(frameworksPath, function (err, frameworks) {
		if (err) {
			return callback(err);
		}
		cache.writeModulesMetadataToCache(frameworks, cacheFilename);
		callback(null, frameworks);
	});
}

/**
 * Detects all frameworks that are under the given search path and returns
 * basic metadata about their location and type
 *
 * @param {String} frameworkSearchPath Path where to search for frameworks
 * @param {frameworkMapCallback} done Callback function
 */
function detectFrameworks(frameworkSearchPath, done) {
	const frameworks = new Map();
	const frameworksEntries = fs.readdirSync(frameworkSearchPath).filter(entryName => /\.framework$/.test(entryName));

	async.each(frameworksEntries, function (searchPathEntry, next) {
		const metadata = detectFramework(path.join(frameworkSearchPath, searchPathEntry));
		frameworks.set(metadata.name, metadata);
		next();
	}, function (err) {
		if (err) {
			done(err);
		}

		done(null, frameworks);
	});
}

/**
 * [detectFramework description]
 * @param  {String} frameworkPath absolute path to a framework's directory (/path/to/UIKit.framework)
 * @return {ModuleMetadata}
 */
function detectFramework(frameworkPath) {
	const frameworkName = path.basename(frameworkPath, '.framework');

	// Assume a dynamic framework? We can sniff the binary file if it exists
	// const child = spawn('file', [ '-b', binaryPathAndFilename ]);
	const frameworkMetadata = new ModuleMetadata(frameworkName, frameworkPath, ModuleMetadata.MODULE_TYPE_DYNAMIC);
	// default umbrella header will be under Headers/frameworkName
	// FIXME Don't set umbrellaHeader if Headers dir doesn't exist
	frameworkMetadata.umbrellaHeader = path.join(frameworkPath, 'Headers', `${frameworkName}.h`);
	return sniffFramework(frameworkMetadata);
}

/**
 * Modifies and returns the framework metadata
 * @param  {ModuleMetadata} frameworkMetadata original metadat for a framework
 * @return {ModuleMetadata} modified metadata, with possibly new values for
 * umbrellaHeader and usesSwift based on info gathered from the framework on disk.
 */
function sniffFramework(frameworkMetadata) { // TODO Move into constructor?
	// If there's a Modules/module.modulemap, use it to give us correct umbrella header
	// and detect if swift is used or not.
	const modulesPath = path.join(frameworkMetadata.path, 'Modules');
	if (!fs.existsSync(modulesPath)) {
		return frameworkMetadata;
	}
	const moduleMapPathAndFilename = path.join(modulesPath, 'module.modulemap');
	if (!fs.existsSync(moduleMapPathAndFilename)) {
		return frameworkMetadata;
	}

	const frameworkHeadersPath = path.join(frameworkMetadata.path, 'Headers');

	const moduleMap = fs.readFileSync(moduleMapPathAndFilename).toString();
	if (fs.readdirSync(modulesPath).length > 1) {
		// Dynamic frameworks containing Swift modules need to have an Objective-C
		// interface header defined to be usable
		frameworkMetadata.usesSwift = true;
		const objcInterfaceHeaderRegex = /header\s"(.+-Swift\.h)"/i;
		const objcInterfaceHeaderMatch = moduleMap.match(objcInterfaceHeaderRegex);
		if (objcInterfaceHeaderMatch !== null) {
			const objcInterfaceHeaderFilename = objcInterfaceHeaderMatch[1];
			const headerPathAndFilename = path.join(frameworkHeadersPath, objcInterfaceHeaderFilename);
			if (!fs.existsSync(headerPathAndFilename)) {
				throw new Error('Objective-C interface header for Swift-based framework ' + frameworkMetadata.name.green + ' not found at expected path ' + headerPathAndFilename.cyan + '.');
			}
			util.logger.trace('Swift based framework detected, parsing Objective-C interface header ' + objcInterfaceHeaderFilename.cyan);
			frameworkMetadata.umbrellaHeader = headerPathAndFilename;
		} else {
			// TODO: New Swift metabase generator required to support pure Swift frameworks
			throw new Error('Incompatible framework ' + frameworkMetadata.name + ' detected. Frameworks with Swift modules are only supported if they contain an Objective-C interface header.');
		}
	} else {
		// check for a specific umbrella header
		const umbrellaHeaderRegex = /umbrella header\s"(.+\.h)"/i;
		const umbrellaHeaderMatch = moduleMap.match(umbrellaHeaderRegex);
		if (umbrellaHeaderMatch !== null) {
			frameworkMetadata.umbrellaHeader = path.join(frameworkHeadersPath, umbrellaHeaderMatch[1]);
		} else {
			// check for an umbrella header directory!
			const umbrellaDirRegex = /umbrella\s"([^"]+)"/i;
			const umbrellaDirMatch = moduleMap.match(umbrellaDirRegex);
			if (umbrellaDirMatch !== null) {
				frameworkMetadata.umbrellaHeader = path.join(frameworkMetadata.path, umbrellaDirMatch[1]);
			}
		}
	}

	// Do we have an umbrella header? If the umbrella header doesn't exist, I think we need to blow up
	if (!frameworkMetadata.umbrellaHeader || !fs.existsSync(frameworkMetadata.umbrellaHeader)) {
		throw new Error(`Unable to detect framework umbrella header for ${frameworkMetadata.name}.`);
	}

	return frameworkMetadata;
}

/**
 * Generates metadata for all frameworks known to the iOS builder.
 *
 * @param {Object} frameworks Object containing base info on all frameworks from the iOS builder
 * @param {String} cacheDir Path to cache directory
 * @param {frameworkMapCallback} callback Callback function
 * @returns {void}
 */
function generateUserFrameworksMetadata(frameworks, cacheDir, callback) {
	const frameworkNames = Object.keys(frameworks);
	const cacheToken = util.createHashFromString(frameworkNames.join(''));
	const cachePathAndFilename = path.join(cacheDir, 'metabase-user-frameworks-' + cacheToken + '.json');
	const cachedMetadata = cache.readModulesMetadataFromCache(cachePathAndFilename);
	if (cachedMetadata !== null) {
		util.logger.trace('Using cached frameworks metadata.');
		return callback(null, cachedMetadata);
	}

	const modules = new Map();
	frameworkNames.forEach(frameworkName => {
		const frameworkInfo = frameworks[frameworkName];
		const metadata = sniffFramework(new ModuleMetadata(frameworkInfo.name, frameworkInfo.path, frameworkInfo.type));
		modules.set(metadata.name, metadata);
	});
	cache.writeModulesMetadataToCache(modules, cachePathAndFilename);
	callback(null, modules);
}

exports.getSystemFrameworks = getSystemFrameworks; // to be used by sdk.js internally only!
exports.generateUserFrameworksMetadata = generateUserFrameworksMetadata; // used by hyperloop hook!
exports.detectFrameworks = detectFrameworks; // for cocoapods...

// TODO: We should encapsulate the idea of a Set of frameworks as a group:
// user, cocoapods, system, 3rd-party
// For each group we can add generic methods about reading/writing to cache
// Cache location is based on group type.
// - System should be cached in ~/.USER_HOME_HYPERLOOP
// - Others likely under the project build dir?

// class FrameworkGroup {
//
// 	/**
// 	 * Constructs a new grouping of frameworks
// 	 *
// 	 * @param {String} type Module type, one of the MODULE_TYPE_* constants
// 	 * @param {Map<string, ModuleMetadata>} frameworks frameworks to wrap
// 	 */
// 	constructor(type, frameworks) {
// 		// TODO Take in cache file path
// 		this.type = type;
// 		this.frameworks = frameworks;
// 	}
//
// 	writeToCache() {
// 		writeModulesMetadataToCache(this.modules, this.cacheFile());
// 	}
//
// 	readFromCache() {
// 		this.modules = readModulesMetadataFromCache(this.cacheFile());
// 	}
//
// 	static systemFrameworks(sdkPath) {
// 		// TODO: Generate cache file path from sdk path
// 		// Read from cache if exists and wrap
// 		// otherwise detect frameworks and then write to cache for next time!
// 	}
//
// 	static userFrameworks(userFrameworks) {
// 		// TODO: Generate cache file path from user framework names? (cache dir can be tmp)
// 		// Read from cache if exists and wrap
// 		// otherwise wrap in ModuleMetadatas and then write to cache for next time!
// 	}
//
// 	static cocoapodsFrameworks(builder) {
//
// 	}
// }

// exports.FrameworkGroup = FrameworkGroup;

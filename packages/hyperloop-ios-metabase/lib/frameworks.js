'use strict';

const exec = require('child_process').exec, // eslint-disable-line security/detect-child-process
	path = require('path'),
	fs = require('fs-extra'),
	async = require('async'),
	semver = require('semver'),
	chalk = require('chalk'),
	cocoapods = require('./cocoapods'),
	metabasegen = require('./metabase'),
	util = require('./util');

/**
 * convert an apple style version (9.0) to a semver compatible version
 * @param {String} ver apple style version string
 * @returns {String}
 */
function appleVersionToSemver(ver) {
	const v = String(ver).split('.');
	if (v.length === 1) {
		return ver + '.0.0';
	}
	if (v.length === 2) {
		return ver + '.0';
	}
	return ver;
}

/**
 * Represents a module, which can be either a static library or a framework.
 */
class ModuleMetadata {

	/**
	 * Constructs a new module metadata object
	 *
	 * @param {String} name Module name
	 * @param {String} path Full path to the module
	 * @param {String} type Module type, one of the MODULE_TYPE_* constants
	 */
	constructor(name, path, type) {
		this.name = name;
		this.path = path;
		this.type = type;
		this.isFramework = this.path.endsWith('.framework');
		this.introducedIn = null;
		this.umbrellaHeader = null;
		this.usesSwift = false;
	}

	/**
	 * Constant for a static module type
	 * @type {String}
	 */
	static get MODULE_TYPE_STATIC() {
		return 'static';
	}

	/**
	 * Constant for a dynamic module type
	 * @type {String}
	 */
	static get MODULE_TYPE_DYNAMIC() {
		return 'dynamic';
	}

	/**
	 * Determines wether this module is available in the given iOS version
	 *
	 * @param {String} iOSVersion iOS version identifier to check the availability for
	 * @return {Boolean} True if this module is available in the given iOS version, false if not
	 */
	isAvailable(iOSVersion) {
		if (semver.valid(this.introducedIn) === null) {
			return true;
		}

		return semver.lte(this.introducedIn, appleVersionToSemver(iOSVersion));
	}

	/**
	 * Returns a serializable object representation of this module.
	 *
	 * @return {Object} Plain object representation of this class
	 */
	toJson() {
		return {
			name: this.name,
			path: this.path,
			type: this.type,
			introducedIn: this.introducedIn,
			umbrellaHeader: this.umbrellaHeader,
			usesSwift: this.usesSwift
		};
	}

	/**
	 * Prases a plain object received from JSON data and converts it back to a
	 * module metadata instance.
	 *
	 * @param {Object} json Object containing data from JSON
	 * @return {ModuleMetadata} The created module metadata instance
	 */
	static fromJson(json) {
		const metadata = new ModuleMetadata(json.name, json.path, json.type);
		metadata.introducedIn = json.introducedIn;
		metadata.umbrellaHeader = json.umbrellaHeader;
		metadata.usesSwift = json.usesSwift;
		return metadata;
	}

	// TODO Move metabase generation to this type?
	generateMetabase(cacheDir, sdkPath, iosMinVersion) {
		// TODO Determine cacheDir based on framework type? system frameworks could be cached in user home!
		// TODO Should we hold sdk path in the metadata? What about min version?
		// Looks like sdk path is baked into the path for system frameworks (it's a prefix!)
		return new Promise((resolve, reject) => {
			metabasegen.generateFrameworkMetabase(cacheDir, sdkPath, iosMinVersion, this, (err, json) => {
				if (err) {
					return reject(err);
				}
				this._metabase = json;
				resolve();
			});
		});
	}
}

/**
* @callback frameworkMapCallback
* @param {Error} err
* @param {Map<string, ModuleMetadata>} frameworks
*/

/**
 * return the system frameworks mappings as JSON for a given sdkType and minVersion
 * @param {String} cacheDir absolute path to cache directory
 * @param {String} sdkPath path to specific SDK we'll sniff for frameworks
 * @param {frameworkMapCallback} callback callback function
 * @returns {void}
 */
function getSystemFrameworks(cacheDir, sdkPath, callback) {
	const cacheToken = util.createHashFromString(sdkPath);
	const cacheFilename = path.join(cacheDir, 'metabase-mappings-' + cacheToken + '.json');
	if (!fs.existsSync(cacheDir)) {
		fs.ensureDirSync(cacheDir);
	} else {
		const cachedMetadata = readModulesMetadataFromCache(cacheFilename);
		if (cachedMetadata !== null) {
			return callback(null, cachedMetadata);
		}
	}

	const frameworksPath = path.resolve(path.join(sdkPath, 'System/Library/Frameworks'));
	detectFrameworks(frameworksPath, function (err, frameworks) {
		if (err) {
			return callback(err);
		}
		writeModulesMetadataToCache(frameworks, cacheFilename);
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
	// If there's a Modules/modulu.modulemap, use it to give us correct umbrella header
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

	return frameworkMetadata;
}

/**
 * return the configured SDK path
 * @param {String} sdkType 'iphoneos' || 'iphonesimulator'
 * @param {getSDKPathCallback} callback callback function
 */
function getSDKPath(sdkType, callback) {
	exec('/usr/bin/xcrun --sdk ' + sdkType + ' --show-sdk-path', function (err, stdout) {
		if (err) {
			return callback(err);
		}
		return callback(null, stdout.trim());
	});
}
/**
 * @callback getSDKPathCallback
 * @param {Error} err
 * @param {string} sdkPath
 */

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
	const cachedMetadata = readModulesMetadataFromCache(cachePathAndFilename);
	if (cachedMetadata !== null) {
		util.logger.trace('Using cached frameworks metadata.');
		return callback(null, cachedMetadata);
	}

	const modules = new Map();
	async.eachSeries(frameworkNames, (frameworkName, next) => {
		const frameworkInfo = frameworks[frameworkName];
		const metadata = sniffFramework(new ModuleMetadata(frameworkInfo.name, frameworkInfo.path, frameworkInfo.type));
		modules.set(metadata.name, metadata);
		next();
	}, (err) => {
		if (err) {
			callback(err);
		}

		writeModulesMetadataToCache(modules, cachePathAndFilename);
		callback(null, modules);
	});
}

/**
 * Takes a Map of names to ModuleMetadata and writes it out to a cache file as JSON
 * @param  {Map<string, ModuleMetadata>} modules modules to write to cache
 * @param  {String} cachePathAndFilename absolute path to cache file to write
 * @return {void}
 */
function writeModulesMetadataToCache(modules, cachePathAndFilename) {
	// TODO Extract a class that wraps a Map<string, ModuleMetadata>?
	// We can then hang methods off of it to read/write to cache, hang the metadata property officially, etc
	const modulesObject = {};
	modules.forEach((entry, key) => {
		if (entry instanceof ModuleMetadata) {
			modulesObject[entry.name] = entry.toJson();
		}
		if (key === '$metadata') {
			modulesObject.$metadata = entry;
		}
	});
	const cacheDir = path.dirname(cachePathAndFilename);
	if (!fs.existsSync(cacheDir)) {
		fs.mkdirSync(cacheDir);
	}
	fs.writeFileSync(cachePathAndFilename, JSON.stringify(modulesObject));
}

/**
 * @param  {String} cachePathAndFilename absolute path to cached file
 * @return {Map<string, ModuleMetadata>}
 */
function readModulesMetadataFromCache(cachePathAndFilename) {
	if (!fs.existsSync(cachePathAndFilename)) {
		return null;
	}

	let json = {};
	try {
		json = JSON.parse(fs.readFileSync(cachePathAndFilename));
	} catch (e) {
		return null;
	}

	const modules = new Map();
	Object.keys(json).forEach(entryName => {
		if (entryName === '$metadata') {
			modules.set('$metadata', json[entryName]);
			return;
		}

		modules.set(entryName, ModuleMetadata.fromJson(json[entryName]));
	});

	return modules;
}

/**
 * Generates a mapping of symbols for CocoaPods third-party libraries and
 * frameworks.
 *
 * This can process both static libraries and frameworks (dynamic frameworks
 * need to expose an ObjC Interface Header).
 *
 * @param {String} cacheDir Path to the cache directory
 * @param {Object} builder iOSBuilder instance
 * @param {String} builder.projectDir path to project directory
 * @param {String} builder.xcodeTarget Active configuration name, i.e. 'Debug', 'Release'
 * @param {String} builder.xcodeTargetOS Active SDK type, i.e. 'iphone' or 'iphonesimulator'
 * @param {Object} settings sdk settings?
 * @param {frameworkMapCallback} callback Callback function
 * @returns {void}
 */
function generateCocoaPodsMetadata(cacheDir, builder, settings, callback) {
	const podLockfilePathAndFilename = path.join(builder.projectDir, 'Podfile.lock');
	const cacheToken = cocoapods.calculateCacheTokenFromPodLockfile(podLockfilePathAndFilename);
	const cachePathAndFilename = path.join(cacheDir, 'metabase-cocoapods-' + cacheToken + '.json');
	const cachedMetadata = readModulesMetadataFromCache(cachePathAndFilename);
	if (cachedMetadata !== null) {
		util.logger.trace('Using cached CocoaPods metadata.');
		return callback(null, cachedMetadata);
	}

	const modules = new Map();
	const tasks = [];

	// Check static libraries
	const podDir = path.join(builder.projectDir, 'Pods');
	if (fs.existsSync(podDir)) {
		const staticLibrariesHeaderPath = path.join(podDir, 'Headers', 'Public');
		if (fs.existsSync(staticLibrariesHeaderPath)) {
			tasks.push(function (next) {

				// Look in path, assume each subdir is a "framework" whose name is the subdir name
				// The path is the sub-dir, the umbrella header is assumed to be a file under the sub-dir with the same name!
				const frameworkNames = gatherSubdirectories(staticLibrariesHeaderPath);
				frameworkNames.forEach(frameworkName => {
					const libraryPath = path.join(staticLibrariesHeaderPath, frameworkName);
					const moduleMetadata = new ModuleMetadata(frameworkName, libraryPath, ModuleMetadata.MODULE_TYPE_STATIC);
					moduleMetadata.umbrellaHeader = path.join(moduleMetadata.path, `${moduleMetadata.name}.h`);
					modules.set(moduleMetadata.name, moduleMetadata);
				});

				next();
			});
		}
	}

	// check for any frameworks under the CocoaPods FRAMEWORK_SEARCH_PATHS
	const cocoaPodsConfigurationBuildDir = getBuiltProductsRootPath(builder.projectDir, builder.xcodeTarget, builder.xcodeTargetOS);
	const frameworkSearchPaths = (settings.FRAMEWORK_SEARCH_PATHS || '').split(' ');
	tasks.push(function (next) {
		async.each(frameworkSearchPaths, function (frameworkSearchPath, done) {
			frameworkSearchPath = frameworkSearchPath.replace('${PODS_ROOT}', settings.PODS_ROOT); // eslint-disable-line no-template-curly-in-string
			frameworkSearchPath = frameworkSearchPath.replace('$PODS_CONFIGURATION_BUILD_DIR', cocoaPodsConfigurationBuildDir);
			frameworkSearchPath = frameworkSearchPath.replace(/"/g, '');
			if (!fs.existsSync(frameworkSearchPath)) {
				return done();
			}
			detectFrameworks(frameworkSearchPath, function (err, frameworks) {
				if (err) {
					return done(err);
				}

				async.each(Array.from(frameworks.values()), function (frameworkMetadata, nextFramework) {
					if (modules.has(frameworkMetadata.name)) {
						// If no use_frameworks! flag is set in the Podfile it is possible
						// that we have a dummy static library whose headers are symlinked to
						// it's backing dynamic framework (e.g. Localytics). Skip parsing the
						// framework for now in those cases.
						return nextFramework();
					}

					modules.set(frameworkMetadata.name, frameworkMetadata);
					nextFramework();
				}, done);
			});
		}, next);
	});

	async.series(tasks, function (err) {
		if (err) {
			return callback(err);
		}

		writeModulesMetadataToCache(modules, cachePathAndFilename);
		callback(err, modules);
	});
}

/**
 * Given a directory, gather the names of all the direct sub-directories.
 * @param  {String} dir [description]
 * @return {String[]}
 */
function gatherSubdirectories(dir) {
	const result = [];
	const files = fs.readdirSync(dir);
	files.forEach(function (filename) {
		const fullPath = path.join(dir, filename);
		if (fs.statSync(fullPath).isDirectory()) {
			result.push(filename);
		}
	});
	return result;
}

/**
 * Gets the full path to the built products directory for the current Xcode build
 * configuration name and SDK type.
 *
 * @param {String} basePath Project root path
 * @param {String} configurationName Active configuration name, i.e. Debug, Release
 * @param {String} sdkType Active SDK type, i.e. iphone or iphonesimulator
 * @return {String} Full path the the products directory
 */
function getBuiltProductsRootPath(basePath, configurationName, sdkType) {
	return path.join(basePath, 'build/iphone/build/Products', configurationName + '-' + sdkType);
}

/**
 * Runs cocoapods if necessary, generates metadata about the frameworks used
 *
 * @param  {String}   cachedir Directory where a cache file may be placed to hold pods metadata for hyperloop
 * @param  {Object}   builder  iOSBuilder
 * @param {String} builder.projectDir path to project directory
 * @param  {generateCocoaPodsCallback} callback callback function
 * @return {void}
 */
function generateCocoaPods(cachedir, builder, callback) {
	const basedir = builder.projectDir;
	const Podfile = path.join(basedir, 'Podfile');
	if (!fs.existsSync(Podfile)) {
		util.logger.debug('No CocoaPods Podfile found. Skipping ...');
		return callback();
	}

	const content = fs.readFileSync(Podfile).toString();

	if (content.indexOf('pod ') === -1) {
		util.logger.warn('Podfile found, but no Pod\'s specified. Skipping ...');
		return callback();
	}

	if (/^use_frameworks!$/m.test(content) === false) {
		util.logger.warn('Using CocoaPods without the "use_frameworks!" flag is deprecated since Hyperloop 3.0.2 and will be removed in Hyperloop 4.0.0.');
		util.logger.warn('Please add "use_frameworks!" to your Podfile to remain compatible with future versions of Hyperloop.');
	}

	cocoapods.runPodInstallIfRequired(basedir, function (err) {
		if (err) {
			return callback(err);
		}

		cocoapods.runCocoaPodsBuild(basedir, builder, function (err) {
			if (err) {
				return callback(err);
			}

			const settings = cocoapods.getCocoaPodsXCodeSettings(basedir);
			util.logger.trace(chalk.green('CocoaPods') + ' Xcode settings will', JSON.stringify(settings, null, 2));

			generateCocoaPodsMetadata(cachedir, builder, settings, function (err, modules) {
				return callback(err, settings, modules);
			});
		});
	});
}
/**
 * @callback generateCocoaPodsCallback
 * @param {Error} err
 * @param {Object} settings cocoapods xcode settings as key/value pairs
 * @param {Map<string, ModuleMetadata>} modules
 */

exports.appleVersionToSemver = appleVersionToSemver; // for testing only!
exports.ModuleMetadata = ModuleMetadata;
exports.getSystemFrameworks = getSystemFrameworks;
exports.generateUserFrameworksMetadata = generateUserFrameworksMetadata;
exports.generateCocoaPods = generateCocoaPods;
exports.getSDKPath = getSDKPath;

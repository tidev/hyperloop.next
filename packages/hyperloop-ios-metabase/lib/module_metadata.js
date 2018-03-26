'use strict';

const path = require('path');
const fs = require('fs-extra');
const semver = require('semver');
const metabasegen = require('./metabase');
const util = require('./util');

/**
 * Temp directory used to cache non-system framework metadata/metabases.
 * @type {string}
 */
const TMP_DIR = process.env.TMPDIR || process.env.TEMP || '/tmp';

/**
 * Represents a module, which can be either a static library or a framework.
 * Right now we have two separate ideas: ModuleMetadata which has top-level data about a Framework and we cache in groupings.
 * From this data we can generate a metabase which we cache per-framework, on-demand.
 * A Set of ModuleMetadata objects is encapsulated by Frameworks.
 * Frameworks class basically encapsulates generatign the set of frameworks of a given type: System, User, Swift, Cocoapods.
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
		this.cacheDir = TMP_DIR;
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
	 * Determines whether this module is available in the given iOS version
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
	 * Parses a plain object received from JSON data and converts it back to a
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

	moduleMap() {
		// possible locations of module map:
		// ./Modules/module.modulemap
		// ./module.map
		const modulesPath = path.join(this.path, 'Modules');
		if (fs.existsSync(modulesPath)) {
			const moduleMapPathAndFilename = path.join(modulesPath, 'module.modulemap');
			if (fs.existsSync(moduleMapPathAndFilename)) {
				return fs.readFileSync(moduleMapPathAndFilename).toString();
			}
		}

		const moduleMapPathAndFilename = path.join(this.path, 'module.map');
		if (fs.existsSync(moduleMapPathAndFilename)) {
			return fs.readFileSync(moduleMapPathAndFilename).toString();
		}

		return null;
	}

	/**
	 * Attempts to detect more details/properties for a given module metadata object.
	 * This is an optional step for some framework types, so is not baked into the constructor.
	 */
	sniff() {
		const frameworkHeadersPath = path.join(this.path, 'Headers');

		const moduleMap = this.moduleMap();
		// If we have a module map, it should tell us what the umbrella header is!
		if (moduleMap) {
			const modulesPath = path.join(this.path, 'Modules');
			if (fs.existsSync(modulesPath) && fs.readdirSync(modulesPath).length > 1) {
				// Dynamic frameworks containing Swift modules need to have an Objective-C
				// interface header defined to be usable
				this.usesSwift = true;
				const objcInterfaceHeaderRegex = /header\s"(.+-Swift\.h)"/i;
				const objcInterfaceHeaderMatch = moduleMap.match(objcInterfaceHeaderRegex);
				if (objcInterfaceHeaderMatch !== null) {
					const objcInterfaceHeaderFilename = objcInterfaceHeaderMatch[1];
					const headerPathAndFilename = path.join(frameworkHeadersPath, objcInterfaceHeaderFilename);
					if (!fs.existsSync(headerPathAndFilename)) {
						throw new Error('Objective-C interface header for Swift-based framework ' + this.name.green + ' not found at expected path ' + headerPathAndFilename.cyan + '.');
					}
					// util.logger.trace('Swift based framework detected, parsing Objective-C interface header ' + objcInterfaceHeaderFilename.cyan);
					this.umbrellaHeader = headerPathAndFilename;
				} else {
					// TODO: New Swift metabase generator required to support pure Swift frameworks
					throw new Error('Incompatible framework ' + this.name + ' detected. Frameworks with Swift modules are only supported if they contain an Objective-C interface header.');
				}
			}

			// if we don't have a special swift variant above...
			if (!this.umbrellaHeader) {
				// check for a specific umbrella header
				const umbrellaHeaderRegex = /umbrella header\s"(.+\.h)"/i;
				const umbrellaHeaderMatch = moduleMap.match(umbrellaHeaderRegex);
				if (umbrellaHeaderMatch !== null) {
					this.umbrellaHeader = path.join(frameworkHeadersPath, umbrellaHeaderMatch[1]);
				} else {
					// check for an umbrella header directory!
					const umbrellaDirRegex = /umbrella\s"([^"]+)"/i;
					const umbrellaDirMatch = moduleMap.match(umbrellaDirRegex);
					if (umbrellaDirMatch !== null) {
						this.umbrellaHeader = path.join(this.path, umbrellaDirMatch[1]);
					}
				}
			}
		}

		// Fall back to "typical" umbrella header if none set
		if (!this.umbrellaHeader) {
			this.umbrellaHeader = path.join(this.path, 'Headers', `${this.name}.h`);
		}

		// If the umbrella header doesn't exist, null it out and warn
		if (!fs.existsSync(this.umbrellaHeader)) {
			// It'd probably be better to throw an Error, but even the iphone system frameworks have a bad framework in IOKit that we need to ignore
			this.umbrellaHeader = null;
			util.logger.warn(`Unable to detect framework umbrella header for ${this.name}.`);
		}
	}

	/**
	 * Returns the metabase JSON object. May be from in-memory cache, on-disk cache, or generated on-demand.
	 * @param  {SDKEnvironment} sdk The SDk information used to generate the metabase
	 * @return {Promise<object>}
	 */
	generateMetabase(sdk) {
		// If we have the cached in-memory copy of the metabase, return it!
		if (this._metabase) {
			return Promise.resolve(this._metabase);
		}

		// TODO Should we hold sdk info in the metadata? Probaby not since it applies to the metabase and not the "metadata"
		return metabasegen.generateFrameworkMetabase(this.cacheDir, sdk, this)
			.then(json => {
				this._metabase = json; // cache in-memory
				return Promise.resolve(json);
			});
	}

	/**
	 * Returns the shallow set of all dependencies (the names of the frameworks)
	 * @param  {SDKEnvironment} sdk The SDk information used to generate the metabase
	 * @return {Promise<Set<string>>}
	 */
	getDependencies(sdk) {
		return this.generateMetabase(sdk)
			.then(metabase => {
				const dependentHeaders = metabase.metadata.dependencies;
				return Promise.resolve(extractFrameworksFromDependencies(dependentHeaders));
			});
	}

	/**
	 * Iterates over a framework's Headers directory and any nested frameworks to
	 * collect the paths to all available header files of a framework.
	 *
	 * @return {string[]} List with paths to all found header files
	 */
	getHeaders() {
		if (!this.umbrellaHeader) {
			return [];
		}
		const stats = fs.statSync(this.umbrellaHeader);
		if (stats.isFile()) { // umbrella header file
			return [ this.umbrellaHeader ];
		} else if (stats.isDirectory()) { // umbrella header directory
			return getAllHeaderFiles([ this.umbrellaHeader ]);
		}
		return [];
	}
}

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
 * Grab the Set of other frameworks referenced from a listing of headers used by a framework.
 * @param  {string[]} headers header files referenced inside a given framework
 * @return {Set<string>}
 */
function extractFrameworksFromDependencies(headers) {
	const frameworks = new Set();
	headers.forEach(file => {
		const index = file.indexOf('.framework');
		if (index !== -1) {
			const frameworkName = file.substring(file.lastIndexOf('/', index) + 1, index);
			frameworks.add(frameworkName);
		}
	});
	return frameworks;
}

/**
 * for an array of directories, return all valid header files
 *
 * @param  {string[]} directories [description]
 * @return {[type]}             [description]
 */
function getAllHeaderFiles(directories) {
	const files = [];
	directories.forEach(dir => {
		recursiveReadDir(dir).forEach(fn => {
			if (/\.(h(pp)?|swift)$/.test(fn)) {
				files.push(fn);
			}
		});
	});
	return files;
}

/**
 * [recursiveReadDir description]
 * @param  {string} dir path to directory to traverse
 * @param  {string[]} result accumulator for recursive calls
 * @return {string[]}
 */
function recursiveReadDir(dir, result) {
	result = result || [];
	const files = fs.readdirSync(dir);
	files.forEach(fn => {
		const fp = path.join(dir, fn);
		if (fs.statSync(fp).isDirectory()) {
			recursiveReadDir(fp, result);
		} else {
			result.push(fp);
		}
	});
	return result;
}

exports.ModuleMetadata = ModuleMetadata;
exports.appleVersionToSemver = appleVersionToSemver; // for testing only!
exports.getAllHeaderFiles = getAllHeaderFiles;

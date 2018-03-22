'use strict';

const path = require('path');
const fs = require('fs-extra');
const semver = require('semver');
const metabasegen = require('./metabase');

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
 * Grab the list of other frameworks referenced from a listing of headers used by a framework.
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
 * Represents a module, which can be either a static library or a framework.
 * Right now we have two separate ideas: ModuleMetadata which has top-level data about a Framework and we cache in groupings.
 * From this data we can generate a metabase which we cache per-framework, on-demand.
 * It's useful to separate metabase generation because it's costlier to produce and much larger.
 * Why cache groupings of framework metadata, though? Why not per-framework? It'd be easier to deal with caching then...
 * Because otherwise we need to do some work already to get the individual paths to look in cache based on the path.
 * We try to grab groups of each type at one time, doesn't require any real work other than the cache key generation.
 */
// TODO Subclass for SystemFramework, UserFramework, SwiftSourceFramework, CocoapodFramework?
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

	/**
	 * Returns a static ModuleMetadata from one or more header files
	 * @param  {string} name framework name to use
	 * @param  {string[]} headers paths to header files
	 * @return {ModuleMetadata}
	 */
	static fromHeaders(name, headers) {
		return new ModuleMetadata(name, headers[0], ModuleMetadata.MODULE_TYPE_STATIC);
	}

	/**
	 * Given a user-defined name/path/type, wrap it up into a ModuleMetadata
	 * @param  {string} name name of the framework
	 * @param  {string} frameworkPath path to framework (folder?)
	 * @param  {string} type type of framework (static or dynamic)
	 * @return {ModuleMetadata}
	 */
	static fromUserFramework(name, frameworkPath, type) {
		return ModuleMetadata.detect(new ModuleMetadata(name, frameworkPath, type));
	}

	/**
	 * Returns a dynamic ModuleMetadata from a given path.
	 * @param  {string} frameworkPath path to framework (folder?)
	 * @return {ModuleMetadata}
	 */
	static fromPath(frameworkPath) {
		const frameworkName = path.basename(frameworkPath, '.framework');
		const frameworkMetadata = new ModuleMetadata(frameworkName, frameworkPath, ModuleMetadata.MODULE_TYPE_DYNAMIC);
		return ModuleMetadata.detect(frameworkMetadata);
	}

	/**
	 * Attempts to detect more details/properties for a given module metadata object and return that.
	 * @param  {ModuleMetadata} frameworkMetadata metadata to start with
	 * @return {ModuleMetadata}
	 */
	static detect(frameworkMetadata) {
		const frameworkHeadersPath = path.join(frameworkMetadata.path, 'Headers');

		// If there's a Modules/module.modulemap, use it to give us correct umbrella header
		// and detect if swift is used or not.
		const modulesPath = path.join(frameworkMetadata.path, 'Modules');
		const moduleMapPathAndFilename = path.join(modulesPath, 'module.modulemap');
		if (fs.existsSync(moduleMapPathAndFilename)) {
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
					// util.logger.trace('Swift based framework detected, parsing Objective-C interface header ' + objcInterfaceHeaderFilename.cyan);
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
		}

		// Fall back to "typical" umbrella header if none set
		if (!frameworkMetadata.umbrellaHeader) {
			frameworkMetadata.umbrellaHeader = path.join(frameworkMetadata.path, 'Headers', `${frameworkMetadata.name}.h`);
		}

		// If the umbrella header doesn't exist, I think we need to blow up
		if (!fs.existsSync(frameworkMetadata.umbrellaHeader)) {
			throw new Error(`Unable to detect framework umbrella header for ${frameworkMetadata.name}.`);
		}

		return frameworkMetadata;
	}

	/**
	 * Returns the metabase JSON object. May be from in-memory cache, on-disk cache, or generated on-demand.
	 * @param  {string} cacheDir Where the cache file is stored on-disk
	 * @param  {SDKEnvironment} sdk The SDk information used to generate the metabase
	 * @return {Promise<object>}
	 */
	generateMetabase(cacheDir, sdk) {
		// If we have the cached in-memory copy of the metabase, return it!
		if (this._metabase) {
			return Promise.resolve(this._metabase);
		}

		// TODO Determine cacheDir based on framework type? We cache system frameworks in user home, others in build dir.
		// Maybe do all in ~/.hyperloop? non-system in tmp dir?
		// TODO Should we hold sdk info in the metadata? Probaby not since it applies to the metabase and not the "metadata"
		return new Promise((resolve, reject) => {
			metabasegen.generateFrameworkMetabase(cacheDir, sdk, this, (err, json) => {
				if (err) {
					return reject(err);
				}
				this._metabase = json;
				resolve(json);
			});
		});
	}

	/**
	 * Returns the shallow set of all dependencies (the names of the frameworks)
	 * @param  {string} cacheDir Where the cache file is stored on-disk
	 * @param  {SDKEnvironment} sdk The SDk information used to generate the metabase
	 * @return {Promise<Set<string>>}
	 */
	getDependencies(cacheDir, sdk) {
		return this.generateMetabase(cacheDir, sdk)
			.then(metabase => {
				const dependentHeaders = metabase.metadata.dependencies;
				return Promise.resolve(extractFrameworksFromDependencies(dependentHeaders));
			});
	}
}

exports.ModuleMetadata = ModuleMetadata;
exports.appleVersionToSemver = appleVersionToSemver; // for testing only!

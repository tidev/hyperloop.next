'use strict';

const metabasegen = require('./metabase');
const semver = require('semver');

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
// TODO Subclass for SystemFramework, UserFramework, SwiftSourceFramework, CocopodFramework?
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

	generateMetabase(cacheDir, sdk) {
		// If we have the cached in-memory copy of the metabase, return it!
		if (this._metabase) {
			return Promise.resolve(this._metabase);
		}

		// TODO Determine cacheDir based on framework type? system frameworks could be cached in user home!
		// TODO Should we hold sdk info in the metadata?
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
}

exports.ModuleMetadata = ModuleMetadata;
exports.appleVersionToSemver = appleVersionToSemver; // for testing only!

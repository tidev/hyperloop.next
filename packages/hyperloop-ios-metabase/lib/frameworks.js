'use strict';

const path = require('path');

const fs = require('fs-extra');

const ModuleMetadata = require('./module_metadata').ModuleMetadata;

const TMP_DIR = process.env.TMPDIR || process.env.TEMP || '/tmp';

/**
 * Encapsulates the idea of a grouping of frameworks (ModuleMetadata).
 * This is a base class and is intended to be subclassed for each group "type":
 * - System
 * - Cocopods
 * - User
 * - ThirdParty
 * - Swift
 *
 * Each type then has implementations to detect the frameworks given the necessary objects/data from it's constructor.
 * Common code for caching/reading from cache is done in this base class.
 */
class Frameworks {

	constructor() {
		this.cacheDir = TMP_DIR;
	}

	/**
	 * Cache the set of frameworks on-disk as JSON.
	 * @return {void}
	 */
	cache() {
		if (!this.modules) {
			throw new Error('No modules loaded yet. Cannot cache!');
		}
		writeModulesMetadataToCache(this.modules, this.cacheFile());
	}

	/**
	 * Attempts to load the modules. May be cached in-memory, on-disk or may need to be calculated on-demand
	 * @return {Promise<Map<string, ModuleMetadata>>}
	 */
	load() {
		// do we have it in memory?
		if (this.modules) {
			return Promise.resolve(this.modules);
		}
		// Try to load from cache if we can
		this.modules = readModulesMetadataFromCache(this.cacheFile(), this.cacheDir);
		if (this.modules) {
			return Promise.resolve(this.modules);
		}
		// Not in-memory or cached on-disk. Do the real work.
		return this.detect().then(modules => {
			// then store in memory and cache on-disk
			this.modules = modules;
			this.cache();
			return Promise.resolve(modules);
		});
	}

	/**
	 * Subclasses should return a Promise<Map<string, ModuleMetadata>> after
	 * generating ModuleMetadata instances from the original source data we were given
	 */
	detect() {
		throw new Error('Subclasses should define behavior here to load the frameworks');
	}

	/**
	 * Subclasses should return a string pointing to the path of the cache file to use
	 */
	cacheFile() {
		throw new Error('Subclasses should define behavior here to generate the filepath to the on-disk json cache for the group');
	}
}

/**
 * Takes a Map of names to ModuleMetadata and writes it out to a cache file as JSON
 * @param  {Map<string, ModuleMetadata>} modules modules to write to cache
 * @param  {String} cachePathAndFilename absolute path to cache file to write
 * @return {void}
 */
function writeModulesMetadataToCache(modules, cachePathAndFilename) {
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
 * @param  {String} cacheDir absolute path to cache dir that the module should use
 * @return {Map<string, ModuleMetadata>}
 */
function readModulesMetadataFromCache(cachePathAndFilename, cacheDir) {
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

		// FIXME This doesn't generate the correct subclasses of ModuleMetadata!
		const metadata = ModuleMetadata.fromJson(json[entryName]);
		metadata.cacheDir = cacheDir;
		modules.set(entryName, metadata);
	});

	return modules;
}

exports.Frameworks = Frameworks;

'use strict';

const path = require('path');

const util = require('./util');
const ModuleMetadata = require('./module_metadata').ModuleMetadata;
const Frameworks = require('./frameworks').Frameworks;

/**
 * Generates metadata for all frameworks known to the iOS builder.
 *
 * @param {object[]} frameworks Object containing base info on all frameworks from the iOS builder
 * @param {string} frameworks[].name name to use for the framework
 * @param {string} frameworks[].path Path to framework
 * @param {string} frameworks[].type Framework type (see ModuleMetadata types)
 * @returns {Promise<Map<string,ModuleMetadata>>}
 */
function getUserFrameworks(frameworks) {
	return new UserFrameworks(frameworks).load();
}

class UserFramework extends ModuleMetadata {
	/**
	 * @param {object} frameworkInfo Object containing base info on all frameworks from the iOS builder
	 * @param {string} frameworkInfo.name name to use for the framework
	 * @param {string} frameworkInfo.path Path to framework
	 * @param {string} frameworkInfo.type Framework type (see ModuleMetadata types)
	 */
	constructor(frameworkInfo) {
		super(frameworkInfo.name, frameworkInfo.path, frameworkInfo.type);
		this.sniff();
	}
}

class UserFrameworks extends Frameworks {
	/**
	 * @param {object[]} userFrameworks Object containing base info on all frameworks from the iOS builder
	 * @param {string} userFrameworks[].name name to use for the framework
	 * @param {string} userFrameworks[].path Path to framework
	 * @param {string} userFrameworks[].type Framework type (see ModuleMetadata types)
	 */
	constructor(userFrameworks) {
		super();
		this.userFrameworks = userFrameworks;
	}

	cacheFile() {
		const frameworkNames = Object.keys(this.userFrameworks);
		const cacheToken = util.createHashFromString(frameworkNames.join(''));
		return path.join(this.cacheDir, `metabase-user-frameworks-${cacheToken}.json`);
	}

	/**
	 * The actual work to detect/load frameworks from original data.
	 * @return {Promise<Map<string, ModuleMetadata>>}
	 */
	detect() {
		const frameworkNames = Object.keys(this.userFrameworks);

		const modules = new Map();
		frameworkNames.forEach(frameworkName => {
			const metadata = new UserFramework(this.userFrameworks[frameworkName]);
			modules.set(metadata.name, metadata);
		});
		return Promise.resolve(modules);
	}
}

exports.getUserFrameworks = getUserFrameworks; // used by hyperloop hook!

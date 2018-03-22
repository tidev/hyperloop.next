'use strict';

const path = require('path');

const fs = require('fs-extra');
const async = require('async');

const util = require('./util');
const ModuleMetadata = require('./module_metadata').ModuleMetadata;
const Frameworks = require('./framework_group').Frameworks;

/**
* @callback frameworkMapCallback
* @param {Error} err
* @param {Map<string, ModuleMetadata>} frameworks
*/

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
	return ModuleMetadata.fromPath(frameworkPath);
}

/**
 * Generates metadata for all frameworks known to the iOS builder.
 *
 * @param {Object} frameworks Object containing base info on all frameworks from the iOS builder
 * @returns {Promise<Map<string,ModuleMetadata>>}
 */
function generateUserFrameworksMetadata(frameworks) {
	return new UserFrameworks(frameworks).load();
}

class UserFrameworks extends Frameworks {
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
			const frameworkInfo = this.userFrameworks[frameworkName];
			const metadata = ModuleMetadata.fromUserFramework(frameworkInfo.name, frameworkInfo.path, frameworkInfo.type);
			modules.set(metadata.name, metadata);
		});
		return Promise.resolve(modules);
	}
}

exports.generateUserFrameworksMetadata = generateUserFrameworksMetadata; // used by hyperloop hook!
exports.detectFrameworks = detectFrameworks; // for cocoapods and sdk.js...

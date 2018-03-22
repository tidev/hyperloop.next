'use strict';

const exec = require('child_process').exec; // eslint-disable-line security/detect-child-process
const path = require('path');

const util = require('./util');
const frameworks = require('./frameworks');
const Frameworks = require('./framework_group').Frameworks;

class SDKEnvironment {

	/**
	 * Constructs a new SDKEnvironment instance
	 *
	 * @param {String} type 'iphoneos' || 'iphonesimulator'
	 * @param {String} path Full path to the sdk
	 * @param {String} minIosVersion minimum iOS version , i.e. '9.0'
	 */
	constructor(type, path, minIosVersion) {
		this.sdkPath = path; // FIXME Shorten the property names once we're moved over!
		this.sdkType = type;
		this.minVersion = minIosVersion;
		this.frameworks = new SystemFrameworks(path);
	}

	/**
	 * Return the configured SDK environment with path.
	 * @param {String} sdkType 'iphoneos' || 'iphonesimulator'
	 * @param {String} minIosVersion minimum iOS version , i.e. '9.0'
	 * @returns {Promise<SDKEnvironment>} A fully constructed SDKEnvironment instance
	 */
	static fromTypeAndMinimumVersion(sdkType, minIosVersion) {
		return new Promise((resolve, reject) => {

			exec('/usr/bin/xcrun --sdk ' + sdkType + ' --show-sdk-path', (err, stdout) => {
				if (err) {
					return reject(err);
				}
				return resolve(new SDKEnvironment(sdkType, stdout.trim(), minIosVersion));
			});
		});
	}

	/**
	 * Return the system frameworks for this sdk
	 * @returns {Promise<Map<string, ModuleMetadata>>}
	 */
	getSystemFrameworks() {
		return this.frameworks.load();
	}
}

class SystemFrameworks extends Frameworks {

	constructor(sdkPath) {
		super();
		this.sdkPath = sdkPath;
	}

	cacheFile() {
		const cacheToken = util.createHashFromString(this.sdkPath);
		return path.join(this.cacheDir, `metabase-mappings-${cacheToken}.json`);
	}

	/**
	 * The actual work to detect/load frameworks from original data.
	 * @return {Promise<Map<string, ModuleMetadata>>}
	 */
	detect() {
		return new Promise((resolve, reject) => {
			const frameworksPath = path.resolve(path.join(this.sdkPath, 'System/Library/Frameworks'));
			frameworks.detectFrameworks(frameworksPath, function (err, frameworks) {
				if (err) {
					return reject(err);
				}
				resolve(frameworks);
			});
		});
	}
}

exports.SDKEnvironment = SDKEnvironment;

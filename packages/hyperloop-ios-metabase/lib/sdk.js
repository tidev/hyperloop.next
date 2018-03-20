'use strict';

const exec = require('child_process').exec; // eslint-disable-line security/detect-child-process
const frameworks = require('./frameworks');

class SDKEnvironment {

	/**
	 * Constructs a new SDKEnvironment instance
	 *
	 * @param {String} type 'iphoneos' || 'iphonesimulator'
	 * @param {String} path Full path to the sdk
	 * @param {String} minIosVersion minimum iOS version , i.e. '9.0'
	 */
	constructor(type, path, minIosVersion) {
		this.sdkPath = path; // FIXME Shorten then property names once we're moved over!
		this.sdkType = type;
		this.minVersion = minIosVersion;
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
		return new Promise((resolve, reject) => {
			frameworks.getSystemFrameworks(this.sdkPath, (err, frameworks) => {
				if (err) {
					return reject(err);
				}
				return resolve(frameworks);
			});
		});
	}
}

exports.SDKEnvironment = SDKEnvironment;

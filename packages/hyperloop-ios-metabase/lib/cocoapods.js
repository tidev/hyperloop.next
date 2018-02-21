'use strict';

const spawn = require('child_process').spawn, // eslint-disable-line security/detect-child-process
	exec = require('child_process').exec, // eslint-disable-line security/detect-child-process
	path = require('path'),
	util = require('./util'),
	semver = require('semver'),
	async = require('async'),
	chalk = require('chalk'),
	fs = require('fs-extra');

/**
 * parse the xcconfig file
 * @param {String} fn absolute path to a file
 * @returns {object}
 */
function parseCocoaPodXCConfig(fn) {
	const config = {};
	fs.readFileSync(fn).toString().split('\n').forEach(function (line) {
		const i = line.indexOf(' = ');
		if (i > 0) {
			const k = line.substring(0, i).trim();
			const v = line.substring(i + 2).trim();
			config[k] = v;
		}
	});
	return config;
}

/**
 * generate a map of xcode settings for CocoaPods
 * @param {String} basedir absolute path to base directory holding Pods
 * @returns {Object}
 */
function getCocoaPodsXCodeSettings(basedir) {
	const podDir = path.join(basedir, 'Pods');
	if (fs.existsSync(podDir)) {
		const target = path.join(podDir, 'Target Support Files'),
			name = fs.readdirSync(target).filter(function (n) { return n.indexOf('Pods-') === 0; })[0],
			dir = path.join(target, name);
		if (fs.existsSync(dir)) {
			const fn = path.join(dir, name + '.release.xcconfig');
			if (fs.existsSync(fn)) {
				const config = parseCocoaPodXCConfig(fn);
				if (config.PODS_ROOT) {
					// fix the PODS_ROOT to point to the absolute path
					config.PODS_ROOT = path.resolve(podDir);
				}
				return config;
			}
		}
	}
}

function isPodInstalled(callback) {
	return exec('which pod', function (err, stdout) {
		if (err) {
			return callback(new Error('CocoaPods not found in your PATH. You can install CocoaPods with: sudo gem install cocoapods'));
		}
		return callback(null, stdout.trim());
	});
}

/**
 * Determines the currently installed version of CocoaPods
 *
 * @param {getCocoaPodsVersionCallback} callback callback function
 * @returns {void}
 */
function getCocoaPodsVersion(callback) {
	return exec('pod --version', function (err, stdout) {
		if (err) {
			return callback(new Error('CocoaPods not found in your PATH. You can install CocoaPods with: sudo gem install cocoapods'));
		}
		return callback(null, stdout.trim());
	});
}
/**
 * @callback getCocoaPodsVersionCallback
 * @param {Error} err
 * @param {string} stdout
 */

function validatePodfile(podfilePath, version, callback) {
	var podfileContent = fs.readFileSync(podfilePath);
	if (semver.gte(version, '1.0.0')) {
		if (!/:integrate_targets\s*=>\s*false/.test(podfileContent)) {
			util.logger.error('Hyperloop requires your Podfile to include :integrate_target => false as an installation option:');
			util.logger.error('');
			util.logger.error('    install! \'cocoapods\', :integrate_targets => false');
			util.logger.error('');
			util.logger.error('For more information please see https://guides.cocoapods.org/syntax/podfile.html#install_bang');
			return callback(new Error('Your Podfile requires changes to use it with Hyperloop. Please see the note above on how to fix it.'));
		}
	}
	return callback();
}

function runPodInstallIfRequired(basedir, callback) {
	var Pods = path.join(basedir, 'Pods'),
		Podfile = path.join(basedir, 'Podfile'),
		cacheToken =  util.createHashFromString(fs.readFileSync(Podfile)),
		cacheFile = path.join(basedir, 'build', '.podcache');

	fs.ensureDirSync(path.dirname(cacheFile));

	if (!fs.existsSync(Pods) || !fs.existsSync(cacheFile) || (fs.existsSync(cacheFile) && fs.readFileSync(cacheFile).toString() !== cacheToken)) {
		async.waterfall([
			isPodInstalled,
			function (pod, callback) {
				getCocoaPodsVersion(function (err, version) {
					callback(err, pod, version);
				});
			},
			function (pod, version, callback) {
				validatePodfile(Podfile, version, function (err) {
					callback(err, pod, version);
				});
			}
		], function (err, pod, version) {
			if (err) {
				return callback(err);
			}
			util.logger.trace('Found CocoaPods ' + version + ' (' + pod + ')');
			if (semver.lt(version, '1.0.0')) {
				util.logger.error('Using a CocoaPods < 1.0.0 is not supported anymore. Please update your CocoaPods installation with: ' + chalk.blue('sudo gem install cocoapods'));
				return callback(new Error('Using a CocoaPods < 1.0.0 is not supported anymore.'));
			}
			util.logger.info(chalk.green('CocoaPods') + ' dependencies found. This will take a few moments but will be cached for subsequent builds');
			var child = spawn(pod, [ 'install' ], { cwd: basedir });
			util.prefixOutput('CocoaPods', child.stdout, util.logger.trace);
			util.prefixOutput('CocoaPods', child.stderr, util.logger.warn);
			child.on('error', callback);
			child.on('exit', function (ec) {
				if (ec !== 0) {
					return callback(new Error('pod install returned a non-zero exit code: ' + ec));
				}
				fs.writeFileSync(cacheFile, cacheToken);
				return callback();
			});
		});
	} else {
		callback();
	}
}

/**
* Runs CocoaPods to build any required libraries
*
* @param {String} basedir absolute path to build directory
* @param {iOSBuilder} builder iosBuilder
* @param {Function} callback callback function
*/
function runCocoaPodsBuild(basedir, builder, callback) {
	var sdkType = builder.xcodeTargetOS,
		sdkVersion = builder.iosSdkVersion,
		minSDKVersion = builder.minIosVer,
		xcodesettings = builder.xcodeEnv.executables,
		// Make sure SDK version is always in MAJOR.MINOR format
		sdk = sdkType + (/\d+\.\d+\.\d+/.test(sdkVersion) ? sdkVersion.substring(0, sdkVersion.lastIndexOf('.')) : sdkVersion),
		productsDirectory = path.join(basedir, 'build/iphone/build/Products'),
		buildConfigurationName = builder.xcodeTarget,
		args = [
			'-configuration', buildConfigurationName,
			'-alltargets',
			'IPHONEOS_DEPLOYMENT_TARGET=' + minSDKVersion,
			'-sdk', sdk,
			'SYMROOT=' + productsDirectory,
			'ONLY_ACTIVE_ARCH=NO'
		];
	var buildOutDir = path.join(productsDirectory, buildConfigurationName + '-' + sdkType),
		runDir = path.join(basedir, 'Pods'),
		child = spawn(xcodesettings.xcodebuild, args, { cwd: runDir });
	util.logger.debug('running ' + xcodesettings.xcodebuild + ' ' + args.join(' ') + ' ' + runDir);
	util.logger.info('Building ' + chalk.green('CocoaPods') + ' dependencies');
	util.prefixOutput('CocoaPods', child.stdout, util.logger.trace);
	util.prefixOutput('CocoaPods', child.stderr, util.logger.warn);
	child.on('error', callback);
	child.on('exit', function (ec) {
		if (ec !== 0) {
			return callback(new Error('the xcodebuild failed running from ' + runDir));
		}
		if (!fs.existsSync(buildOutDir)) {
			return callback(new Error('xcodebuild did not produce the expected CocoaPods libraries at ' + buildOutDir));
		}

		return callback();
	});
}

/**
 * Calculates a cache token based on the Podfile checksum and all installed pod
 * specs checksums.
 *
 * If one of these checksums change, either the Podfile changed or a Pod was
 * updated/installed/removed, resulting in a changed cache token and the
 * CocoaPods symbol mapping will be regenerated.
 *
 * @param {string} podLockfilePathAndFilename absolute path to the Pod.lock file
 * @return {string} The generated cache token
 */
function calculateCacheTokenFromPodLockfile(podLockfilePathAndFilename) {
	if (!fs.existsSync(podLockfilePathAndFilename)) {
		throw new Error('No Podfile.lock found in your project root. ');
	}
	const cacheTokenData = { podfile: '', specs: [] };
	const podLockfileContent = fs.readFileSync(podLockfilePathAndFilename).toString();
	const specChecksumRegex = /[ ]{2}[^.][^\s/]*:\s(.*)/ig;
	let checksumMatches = specChecksumRegex.exec(podLockfileContent);
	if (checksumMatches === null) {
		throw new Error('Could not read spec checksums from Podfile.lock');
	}
	while (checksumMatches !== null) {
		cacheTokenData.specs.push(checksumMatches[1]);
		checksumMatches = specChecksumRegex.exec(podLockfileContent);
	}
	const podfileChecksumMatch = podLockfileContent.match(/PODFILE CHECKSUM: (.*)/);
	if (podfileChecksumMatch === null) {
		throw new Error('Could not read Podfile checksum from Podfile.lock');
	}
	cacheTokenData.podfile = podfileChecksumMatch[1];
	return util.createHashFromString(JSON.stringify(cacheTokenData));
}

exports.calculateCacheTokenFromPodLockfile = calculateCacheTokenFromPodLockfile;
exports.runPodInstallIfRequired = runPodInstallIfRequired;
exports.runCocoaPodsBuild = runCocoaPodsBuild;
exports.getCocoaPodsXCodeSettings = getCocoaPodsXCodeSettings;

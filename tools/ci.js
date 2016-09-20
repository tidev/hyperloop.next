/**
 * CI Build Script
 * Copyright (c) 2015 by Appcelerator, Inc. All Rights Reserved.
 */
var path = require('path'),
	fs = require('fs'),
	async = require('async'),
	http = require('http'),
	request = require('request'),
	colors = require('colors'),
	wrench = require('wrench'),
	temp = require('temp'),
	appc = require('node-appc'),
	exec = require('child_process').exec,
	spawn = require('child_process').spawn,
	tiver = require('./tiver'),
	afs = appc.fs,
	HOME = process.env.HOME || process.env.USERPROFILE || process.env.APPDATA,
	titanium = path.join(__dirname, '..', 'node_modules', 'titanium', 'bin', 'titanium'),
	androidModuleDir = path.join(__dirname, '..', 'android'),
	iosModuleDir = path.join(__dirname, '..', 'iphone'),
	buildTempDir = path.join(__dirname, '..', 'build'),
	TITANIUM_ANDROID_API = 21, // This is required right now by the module building scripts, as it's set as the default there. I don't see a way to override it!
	ANDROID_SDK_URL = 'http://dl.google.com/android/android-sdk_r24.4.1-macosx.zip',
	ANDROID_NDK_URL = 'http://dl.google.com/android/ndk/android-ndk-r8c-darwin-x86.tar.bz2',
	tiSDKBranch = '5_5_X';

function downloadURL(url, callback) {
	console.log('Downloading %s', url.cyan);

	var tempName = temp.path({ suffix: '.zip' }),
		tempDir = path.dirname(tempName);
	fs.existsSync(tempDir) || wrench.mkdirSyncRecursive(tempDir);

	var tempStream = fs.createWriteStream(tempName),
		req = request({ url: url });

	req.pipe(tempStream);

	req.on('error', function (err) {
		fs.existsSync(tempName) && fs.unlinkSync(tempName);
		console.log();
		console.error('Failed to download URL: %s', err.toString() + '\n');
		process.exit(1);
	});

	req.on('response', function (req) {
		if (req.statusCode >= 400) {
			// something went wrong, abort
			console.log();
			console.error('Request failed with HTTP status code %s %s\n', req.statusCode, http.STATUS_CODES[req.statusCode] || '');
			process.exit(1);
		} else if (req.headers['content-length']) {
			// we know how big the file is, display the progress bar
			var total = parseInt(req.headers['content-length']),
				bar;

			if (!process.argv.indexOf('--quiet') && !process.argv.indexOf('--no-progress-bars')) {
				bar = new appc.progress('  :paddedPercent [:bar] :etas', {
					complete: '='.cyan,
					incomplete: '.'.grey,
					width: 40,
					total: total
				});
			}

			req.on('data', function (buffer) {
				bar && bar.tick(buffer.length);
			});

			tempStream.on('close', function () {
				if (bar) {
					bar.tick(total);
					console.log('\n');
				}
				callback(tempName);
			});
		} else {
			// we don't know how big the file is, display a spinner
			var busy;

			if (!process.argv.indexOf('--quiet') && !process.argv.indexOf('--no-progress-bars')) {
				busy = new appc.busyindicator;
				busy.start();
			}

			tempStream.on('close', function () {
				busy && busy.stop();
				logger.log();
				callback(tempName);
			});
		}
	});
}

function extract(filename, installLocation, keepFiles, callback) {
	console.log('Extracting to %s', installLocation.cyan);

	var bar;

	appc.zip.unzip(filename, installLocation, {
		visitor: function (entry, i, total) {
			if (i == 0) {
				if(!process.argv.indexOf('--quiet') && !process.argv.indexOf('--no-progress-bars')) {
					bar = new appc.progress('  :paddedPercent [:bar]', {
						complete: '='.cyan,
						incomplete: '.'.grey,
						width: 40,
						total: total
					});
				}
			}
			bar && bar.tick();
		}
	}, function (err, extracted, total) {
		if (err) {
			keepFiles || fs.unlinkSync(filename);
			console.log();
			console.error('Failed to unzip');
			String(err).trim().split('\n').forEach(console.error);
			console.log();
			process.exit(1);
		} else {
			if (bar) {
				bar.tick(total);
				console.log('\n');
			}
			keepFiles || fs.unlinkSync(filename);
			callback();
		}
	});
}

/**
 * Installs latest Ti SDK required by the Hyperloop version we are about to build
 *
 * @param {Function} next
 */
function installAndSelectLatestTiSDK(next) {
	var hyperloopVersion = require(path.join(__dirname, '..', 'package.json')).version;
	var isUpToDate = false;
	var installedVersion;
	console.log(('Checking for updated Ti SDK from ' + tiSDKBranch + ' branch.').green);
	var args = ['sdk', 'install', '-b', tiSDKBranch, '-d', '--no-banner'];
	if (process.argv.indexOf('--no-progress-bars') != -1) {
		args.push('--no-progress-bars');
	}
	var child = spawn(titanium, args);
	child.stdout.on('data', function(buffer) {
		var message = buffer.toString();
		if (message.indexOf('You\'re up-to-date') !== -1) {
			isUpToDate = true;
			versionMatch = message.match(/Version\s([\d\.v]+)/);
			installedVersion = versionMatch[1];
		}
	});
	child.on('exit', function (code) {
		if (code !== 0) {
			next('Failed to install latest ' + tiSDKBranch + ' SDK. Exit code: ' + code);
		} else {
			if (isUpToDate && installedVersion) {
				console.log('Latest version ' + installedVersion + ' already installed, select it!');
				return selectTiSDKVersion(installedVersion, next);
			}
			console.log('Installed and selected latest Ti SDK build from branch ' + tiSDKBranch + '.');
			next();
		}
	});
	child.on('error', next);
}

/**
 * Selects a specific Ti SDK version
 *
 * @param {String} version The version to select
 * @param {Function} next
 */
function selectTiSDKVersion(version, next) {
	var child = spawn(titanium, ['sdk', 'select', version, '--no-banner']);
	child.on('exit', function (code) {
		if (code !== 0) {
			next(new Error('Failed to select SDK ' + version + '. Exit code: ' + code));
		} else {
			console.log('Selected Ti SDK ' + version);
			next();
		}
	});
	child.on('error', next);
}

// Grab the Android home location
function getAndroidPaths(next) {
	exec('"' + titanium + '" info -o json -t android', function (error, stdout, stderr) {
		if (error) {
			return next('Failed to get ANDROID NDK and SDK paths: ' + error);
		}
		var out = JSON.parse(stdout);
		var androidSDKPath = out.android && out.android.sdk && out.android.sdk.path;
		var androidNDKPath = out.android && out.android.ndk && out.android.ndk.path;

		// Fall back to env vars for these values
		if (!androidNDKPath) {
			androidNDKPath = process.env.ANDROID_NDK;
		}
		if (!androidSDKPath) {
			androidSDKPath = process.env.ANDROID_SDK;
		}

		process.env.ANDROID_SDK = androidSDKPath;
		process.env.ANDROID_NDK = androidNDKPath;

		next(null, {sdk: androidSDKPath, ndk: androidNDKPath});
	});
}

function installAndroidSDK(next) {
	var sdkHome = path.join(HOME, 'android-sdk-macosx');
	if (fs.existsSync(sdkHome)) {
		console.log("Android SDK found at", sdkHome);
		process.env.ANDROID_SDK = sdkHome;
		return next(null, sdkHome);
	}

	console.log("Installing Android SDK".green);

	downloadURL(ANDROID_SDK_URL, function (filename) {
		extract(filename, HOME, true, function() {
			// Set the path to it in titanium config!
			exec('"' + titanium + '" config android.sdkPath ' + sdkHome, function (error, stdout, stderr) {
				if (error !== null) {
					return next('Failed to set android.sdkPath in CLI config: ' + error);
				}
				process.env.ANDROID_SDK = sdkHome;
				next(null, sdkHome);
			});
		});
	});
}

function installAndroidSDKComponents(androidSDKPath, next) {
	var androidBin = path.join(androidSDKPath, 'tools', 'android'),
		buildToolsFolder = path.join(androidSDKPath, 'build-tools'),
		shellSyntaxCommand = "echo 'y' | " + androidBin + ' -s update sdk --no-ui --all --filter tools;' +
		"echo 'y' | " + androidBin + ' -s update sdk --no-ui --all --filter platform-tools;' +
		"echo 'y' | " + androidBin + ' -s update sdk --no-ui --all --filter build-tools-' + TITANIUM_ANDROID_API + '.0.1;' +
		"echo 'y' | " + androidBin + ' -s update sdk --no-ui --all --filter extra-android-support;' + // FIXME Do we need this?
		"echo 'y' | " + androidBin + ' -s update sdk --no-ui --all --filter android-' + TITANIUM_ANDROID_API +';' +
		"echo 'y' | " + androidBin + ' -s update sdk --no-ui --all --filter addon-google_apis-google-' + TITANIUM_ANDROID_API,
		prc;
	if (fs.existsSync(buildToolsFolder)) {
		console.log("Android SDK + Tools already installed at", androidBin);
		return next();
	}
	console.log("Installing and configuring Android SDK + Tools");
	prc = spawn('sh', ['-c', shellSyntaxCommand], { stdio: 'inherit' });
	prc.on('close', function (code) {
		if (code !== 0) {
			next("Failed to build install Android SDK components. Exit code: " + code);
		} else {
			next();
		}
	});
	prc.on('error', next);
}

function installAndroidNDK(next) {
	var ndkHome = path.join(HOME, 'android-ndk-r8c');
	if (fs.existsSync(ndkHome)) {
		console.log("Android NDK already installed at", ndkHome);
		process.env.ANDROID_NDK = ndkHome;
		return next(null, ndkHome);
	}

	console.log("Installing Android NDK".green);
	downloadURL(ANDROID_NDK_URL, function (filename) {
		exec('tar xzf "' + filename + '" -C "' + HOME + '"', function (error, stdout, stderr) {
			if (error !== null) {
				return next('Failed to extract Android NDK: ' + error);
			}
			exec('"' + titanium + '" config android.ndkPath ' + ndkHome, function (error, stdout, stderr) {
				if (error !== null) {
					return next('Failed to set path to Android NDK in titanium CLI config: ' + error);
				}
				process.env.ANDROID_NDK = ndkHome;
				next(null, ndkHome);
			});
		});
	});
}

/**
 * Given the paths to the Titanium SDK, the android SDK, and the Android NDK - write out the build.properties for Android/ANT to build against
 **/
function writeBuildProperties(tiSDKPath, androidSDKPath, androidNDKPath, next) {
	console.log('Writing build.properties for Ant'.green);
	// Write out properties file
	var buildProperties = path.join(androidModuleDir, 'build.properties'),
		content = "";
	content += 'titanium.platform=' + tiSDKPath + '/android\n';
	content += 'android.platform=' + androidSDKPath + '/platforms/android-' + TITANIUM_ANDROID_API + '\n';
	content += 'google.apis=' + androidSDKPath + '/add-ons/addon-google_apis-google-' + TITANIUM_ANDROID_API + '\n';
	content += 'android.ndk=' + androidNDKPath + '\n';
	console.log('writing to', buildProperties);
	fs.writeFile(buildProperties, content, next);
}

function writeTitaniumXcconfig(tiSDKPath, next) {
	console.log('Writing titanium.xcconfig for iOS');
	// Write out properties file
	var buildProperties = path.join(iosModuleDir, 'titanium.xcconfig'),
		content = "";

	// if it exists, wipe it
	if (fs.existsSync(buildProperties)) {
		fs.unlinkSync(buildProperties);
	}

	content += 'TITANIUM_SDK = ' + tiSDKPath + '\n';
	content += 'TITANIUM_BASE_SDK = "$(TITANIUM_SDK)/iphone/include"\n';
	content += 'TITANIUM_BASE_SDK2 = "$(TITANIUM_SDK)/iphone/include/TiCore"\n';
	content += 'TITANIUM_BASE_SDK3 = "$(TITANIUM_SDK)/iphone/include/JavaScriptCore"\n';
	content += 'HEADER_SEARCH_PATHS= $(TITANIUM_BASE_SDK) $(TITANIUM_BASE_SDK2) $(TITANIUM_BASE_SDK3)\n';
	fs.writeFile(buildProperties, content, next);
}

function runBuildScript(next) {
	console.log('Running build'.green);

	var prc = spawn('sh', ['-c', path.join(__dirname, '..', 'build.sh')], { stdio:'inherit', cwd: path.join(__dirname, '..') });
	prc.on('exit', function (code) {
		if (code !== 0) {
			next("Failed to build. Exit code: " + code);
		} else {
			next();
		}
	});
	prc.on('error', next);
}

/**
 * write the updated android manifest if necessary
 */
function writeAndroidManifest(next) {
	var fn = path.join(__dirname, '..', 'android', 'manifest'),
		pkg = require(path.join(__dirname, '..', 'package.json')),
		contents = fs.readFileSync(fn).toString(),
		buf = contents.replace(/version: (.*)/,'version: ' + pkg.version);

	// if the version is different, update it
	if (buf !== contents) {
		fs.writeFile(fn, buf, next);
	} else {
		next();
	}
}

/**
 * write the updated ios manifest if necessary
 */
function writeiOSManifest(next) {
	var fn = path.join(__dirname, '..', 'iphone', 'manifest'),
		pkg = require(path.join(__dirname, '..', 'package.json')),
		contents = fs.readFileSync(fn).toString(),
		buf = contents.replace(/version: (.*)/,'version: ' + pkg.version);

	// if the version is different, update it
	if (buf !== contents) {
		fs.writeFile(fn, buf, next);
	} else {
		next();
	}
}

/**
 * write the updated android plugin package.json if neccesary
 */
function writeAndroidPluginPackage (next) {
	var fn = path.join(__dirname, '..', 'android', 'plugins', 'hyperloop', 'package.json'),
		pkg = require(path.join(__dirname, '..', 'package.json')),
		fnc = require(fn);

	// if the version is different, update it
	if (pkg.version !== fnc.version) {
		fnc.version = pkg.version;
		fs.writeFile(fn, JSON.stringify(fnc, null, 2), next);
	} else {
		next();
	}
}

/**
 * The whole shebang. Installs latest and greatest Titanium SDK from 5_4_X,
 * Android SDK/NDK, sets up the android/build.properties to point at them,
 * iphone/titanium.xcconfig, then runs the build.sh file in the root of the repo
 * If you already have dependencies installed, this is overkill. But useful for
 * clean CI environments.
 */
function build(callback) {
	var tiSDKPath,
		androidSDKPath,
		androidNDKPath,
		preBuildSelectedTiSDKVersion;

	// set the environment variable CI during build
	process.env.CI = 1;

	async.series([
		function (next) {
			if (fs.existsSync(buildTempDir)) {
				wrench.rmdirSyncRecursive(buildTempDir);
			}
			wrench.mkdirSyncRecursive(buildTempDir);
			next();
		},
		// Install latest Titanium SDK
		function (next) {
			async.waterfall([
				tiver.getActivePath,
				function savePreviouslySelectedTiSDKVersion(sdkPath, version, callback) {
					preBuildSelectedTiSDKVersion = version;
					callback();
				},
				installAndSelectLatestTiSDK
			], function(err) {
				next(err);
			});
		},
		// Grab location it got installed
		function (next) {
			tiver.getActivePath(function (err, sdkPath, version) {
				if (err) {
					return next(err);
				}
				tiSDKPath = sdkPath;
				next();
			});
		},
		// TODO Do we need to install xcode or something?
		// TODO Install python if it's not installed?

		// Grab the paths to Android NDK and SDK
		function (next) {
			console.log("Checking Android paths");
			getAndroidPaths(function (err, result) {
				androidSDKPath = result.sdk;
				androidNDKPath = result.ndk;
				next();
			});
		},
		// In parallel, install Android SDK and NDK (and components) if necessary
		function (cb) {
			async.parallel([
				// SDK
				function (cb) {
					async.series([
						function (next) {
							if (androidSDKPath && fs.existsSync(androidSDKPath)) {
								return next();
							}

							installAndroidSDK(function(err, sdkPath) {
								if (err) {
									return next(err);
								}
								androidSDKPath = sdkPath;
								next();
							});
						},
						function (next) {
							// TODO Is there any way we can just verify the components we want are already installed?
							installAndroidSDKComponents(androidSDKPath, next);
						}
					], cb);
				},
				// NDK
				function (next) {
					if (androidNDKPath && fs.existsSync(androidNDKPath)) {
						return next();
					}

					installAndroidNDK(function(err, ndkPath) {
						if (err) {
							return next(err);
						}
						androidNDKPath = ndkPath;
						next();
					});
				}
			], cb);
		},
		// Point to the Titanium SDK, Android NDK and Android SDK we just installed for Android module build
		function (next) {
			writeBuildProperties(tiSDKPath, androidSDKPath, androidNDKPath, next);
		},
		// Point to the Titanium SDK we just installed for iOS module build
		function (next) {
			writeTitaniumXcconfig(tiSDKPath, next);
		},
		writeAndroidManifest,
		writeiOSManifest,
		writeAndroidPluginPackage,
		runBuildScript,
		function (next) {
			wrench.rmdirSyncRecursive(buildTempDir);
			next();
		},
		// TODO Remove the Titanium SDK we installed to avoid cluttering up HDD?
		function (next) {
			if (!preBuildSelectedTiSDKVersion) {
				return next();
			}
			console.log('Switching back to Ti SDK that was selected before our build.');
			selectTiSDKVersion(preBuildSelectedTiSDKVersion, next);
		}
	], callback);
}

// public API
exports.build = build;

// When run as single script.
if (module.id === ".") {
	build(function (err, results) {
		// unset after we run
		delete process.env.CI;
		if (err) {
			console.error(err.toString().red);
			process.exit(1);
		} else {
			process.exit(0);
		}
	});
}

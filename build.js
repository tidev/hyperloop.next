/**
 * Copyright (c) 2015 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License.
 * Please see the LICENSE included with this distribution for details.
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
	afs = appc.fs,
	HOME = process.env.HOME || process.env.USERPROFILE || process.env.APPDATA,
	titanium = path.join(__dirname, 'node_modules', 'titanium', 'bin', 'titanium'),
	androidModuleDir = path.join(__dirname, 'android'),
	iosModuleDir = path.join(__dirname, 'ios'),
	TITANIUM_ANDROID_API = 21, // This is required right now by the module building scripts, as it's set as the default there. I don't see a way to override it!
	ANDROID_SDK_URL = 'http://dl.google.com/android/android-sdk_r24.0.1-macosx.zip',
	ANDROID_NDK_URL = 'http://dl.google.com/android/ndk/android-ndk-r8c-darwin-x86.tar.bz2';

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

// Install master branch Titanium SDK
function installSDK(next) {
	var args = [titanium, 'sdk', 'install', '-b', 'master', '-d'],
		prc;
	if (process.argv.indexOf('--no-progress-bars') != -1) {
		args.push('--no-progress-bars');
	}
	prc = spawn('node', args);
	prc.stdout.on('data', function (data) {
		console.log(data.toString().trim());
	});
	prc.stderr.on('data', function (data) {
		console.error(data.toString().trim());
	});

	prc.on('close', function (code) {
		if (code != 0) {
			next("Failed to install master SDK. Exit code: " + code);
		} else {
			next();
		}
	});
}

function getSDKInstallDir(next) {
	exec('node "' + titanium + '" info -o json -t titanium', function (error, stdout, stderr) {
		var out,
			selectedSDK,
			sdkPath;
		if (error !== null) {
		  next('Failed to get SDK install dir: ' + error);
		}

		out = JSON.parse(stdout);
		selectedSDK = out['titaniumCLI']['selectedSDK'];

		sdkPath = out['titanium'][selectedSDK]['path'];
		next(null, sdkPath);
	});
}

// Grab the Android home location
function getAndroidPaths(next) {
	exec('node "' + titanium + '" info -o json -t android', function (error, stdout, stderr) {
		var out,
			androidSDKPath,
			androidNDKPath
		if (error !== null) {
		  next('Failed to get ANDROID_HOME: ' + error);
		}

		out = JSON.parse(stdout);
		androidSDKPath = out.android && out.android.sdk && out.android.sdk.path;
		androidNDKPath = out.android && out.android.ndk && out.android.ndk.path;
		next(null, {sdk: androidSDKPath, ndk: androidNDKPath});
	});
}

function installAndroidSDK(next) {
	console.log("Installing Android SDK");

	downloadURL(ANDROID_SDK_URL, function (filename) {
		extract(filename, HOME, true, function() {
			// Set the path to it in titanium config!
			var sdkHome = path.join(HOME, 'android-sdk-macosx');
			exec('node "' + titanium + '" config android.sdkPath ' + sdkHome, function (error, stdout, stderr) {
				if (error !== null) {
					next('Failed to set ANDROID_HOME: ' + error);
				}
				next(null, sdkHome);
			});
		});
	});
}

function installAndroidSDKComponents(androidSDKPath, next) {
	console.log("Installing and configuring Android SDK + Tools");

	var androidBin = path.join(androidSDKPath, 'tools', 'android'),
		// FIXME This re-installs these even if we aready have them! I think we need more fiddling, to remove --all, but that doesn't work just removing it.
		shellSyntaxCommand = "echo 'y' | " + androidBin + ' -s update sdk --no-ui --all --filter tools,platform-tools,build-tools-23.0.1,extra-android-support,android-8,android-10,android-' + TITANIUM_ANDROID_API + ',addon-google_apis-google-' + TITANIUM_ANDROID_API,
		prc;
	prc = spawn('sh', ['-c', shellSyntaxCommand], { stdio: 'inherit' });
	prc.on('close', function (code) {
		if (code != 0) {
			next("Failed to build install Android SDK components. Exit code: " + code);
		} else {
			next();
		}
	});
}

function installAndroidNDK(next) {
	console.log("Installing Android NDK");

	downloadURL(ANDROID_NDK_URL, function (filename) {
		exec('tar xzf "' + filename + '" -C "' + HOME + '"', function (error, stdout, stderr) {
			if (error !== null) {
				return next('Failed to sextract Android NDK: ' + error);
			}
			var ndkHome = path.join(HOME, 'android-ndk-r8c');
			exec('node "' + titanium + '" config android.ndkPath ' + ndkHome, function (error, stdout, stderr) {
				if (error !== null) {
					return next('Failed to set path to Android NDK in titanium CLI config: ' + error);
				}
				next(null, ndkHome);
			});
		});
	});
}

/**
 * Given the paths to the Titanium SDK, the android SDK, and the Android NDK - write out the build.properties for Android/ANT to build against
 **/
function writeBuildProperties(tiSDKPath, androidSDKPath, androidNDKPath, next) {
	console.log('Writing build.properties for Ant');
	// Write out properties file
	var buildProperties = path.join(androidModuleDir, 'build.properties'),
		content = "";
	// if it exists, wipe it
	if (fs.existsSync(buildProperties)) {
		fs.unlinkSync(buildProperties);
	}
	content += 'titanium.platform=' + tiSDKPath + '/android\n';
	content += 'android.platform=' + androidSDKPath + '/platforms/android-' + TITANIUM_ANDROID_API + '\n';
	content += 'google.apis=' + androidSDKPath + '/add-ons/addon-google_apis-google-' + TITANIUM_ANDROID_API + '\n';
	content += 'android.ndk=' + androidNDKPath + '\n';
	fs.writeFile(buildProperties, content, next);
}

// TODO When we combine and do iOS and Android builds
function writeTitaniumXcconfig(next) {
	// Write out properties file
//	echo "TITANIUM_SDK = $TITANIUM_SDK" > $MODULE_ROOT/titanium.xcconfig
//	echo "TITANIUM_BASE_SDK = \"\$(TITANIUM_SDK)/iphone/include\"" >> $MODULE_ROOT/titanium.xcconfig
//	echo "TITANIUM_BASE_SDK2 = \"\$(TITANIUM_SDK)/iphone/include/TiCore\"" >> $MODULE_ROOT/titanium.xcconfig
//	echo "TITANIUM_BASE_SDK3 = \"\$(TITANIUM_SDK)/iphone/include/ASI\"" >> $MODULE_ROOT/titanium.xcconfig
//	echo "TITANIUM_BASE_SDK4 = \"\$(TITANIUM_SDK)/iphone/include/APSHTTPClient\"" >> $MODULE_ROOT/titanium.xcconfig
//	echo "HEADER_SEARCH_PATHS= \$(TITANIUM_BASE_SDK) \$(TITANIUM_BASE_SDK2) \$(TITANIUM_BASE_SDK3) \$(TITANIUM_BASE_SDK4) \${PROJECT_DIR}/**" >> $MODULE_ROOT/titanium.xcconfig
}

function runAnt(next) {
	console.log('Running Ant build');
	exec('ant clean', {cwd: androidModuleDir}, function (error, stdout, stderr) {
		var prc;
		if (error !== null) {
			return next('Failed to run ant clean: ' + error);
		}
		prc = spawn('ant', [], {cwd: androidModuleDir});
		prc.stdout.on('data', function (data) {
			console.log(data.toString().trim());
		});
		prc.stderr.on('data', function (data) {
			console.error(data.toString().trim());
		});

		prc.on('close', function (code) {
			if (code != 0) {
				next("Failed to build Android module. Exit code: " + code);
			} else {
				next();
			}
		});
	});
}

// TODO Install python if it's not installed!

/**
 * The whole shebang. Installs latest and greatest Titanium SDK from master,
 * Android SDK/NDK, sets up the android/build.properties to point at them, then
 * runs ant && ant clean.
 * TODO Do the iOS build once we combine the module and then combine the zips
 */
function build(callback) {
	var tiSDKPath,
		androidSDKPath,
		androidNDKPath;
	async.series([
		// TODO Remove old SDKs we've installed before to avoid littering HDD with tons of SDKs
		// Run in series with getting sdk install dir
		installSDK,
		function (next) {
			getSDKInstallDir(function (err, sdkPath) {
				if (err) {
					return next(err);
				}
				tiSDKPath = sdkPath;
				next();
			});
		},
		function (next) {
			console.log("Checking Android paths");
			getAndroidPaths(function (err, result) {
				androidSDKPath = result.sdk;
				androidNDKPath = result.ndk;
				next();
			});
		},
		// Run in parallel with the SDK tasks above
//		function (next) {
//			console.log("Installing ANT");
//			installAnt(next);
//		},
		// In parallel, install Android SDK and NDK
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
		function (next) {
			writeBuildProperties(tiSDKPath, androidSDKPath, androidNDKPath, next);
		},
		runAnt
	], callback);
}

// public API
exports.build = build;

// When run as single script.
if (module.id === ".") {
	build(function (err, results) {
		if (err) {
			console.error(err.toString().red);
			process.exit(1);
		} else {
			process.exit(0);
		}
	});
}

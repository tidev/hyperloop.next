'use strict';

const spawn = require('child_process').spawn; // eslint-disable-line security/detect-child-process
const plist = require('simple-plist');
const path = require('path');
const fs = require('fs-extra');

let tmpdirs = [];
let settings;

function getSimulatorSDK(callback) {
	if (settings) {
		return callback(null, settings);
	}

	const child = spawn('xcode-select', [ '-print-path' ]);
	child.stdout.on('data', buf => {
		const dir = buf.toString().replace(/\n$/, ''),
			sdkdir = path.join(dir, 'Platforms/iPhoneSimulator.platform/Developer/SDKs/iPhoneSimulator.sdk'),
			sdkSettings = path.join(sdkdir, 'SDKSettings.plist');
		if (!fs.existsSync(sdkSettings)) {
			return callback(new Error('iOS SDK not found'));
		}

		const val = plist.parse(fs.readFileSync(sdkSettings));
		settings = {
			basedir: dir,
			sdkdir: sdkdir,
			version: val.DefaultDeploymentTarget || val.version
		};
		return callback(null, settings);
	});
	child.on('error', callback);
}

function getBinary(callback) {
	const bin = path.join(__dirname, '..', 'bin', 'metabase');
	if (fs.existsSync(bin)) {
		return callback(null, bin);
	}

	console.log('attempting to compile metabase for the first time ...');
	const child = spawn(path.join(__dirname, '..', 'build.sh'), [], { stdio: 'pipe' });
	// child.stderr.on('data', function (buf) {
	// 	// console.error(buf.toString().replace(/\n$/, ''));
	// });
	// child.stdout.on('data', function (buf) {
	// 	// console.log(buf.toString().replace(/\n$/, ''));
	// });
	child.on('error', callback);
	child.on('exit', err => {
		if (err !== 0) {
			return callback(new Error('metabase compile failed'));
		}
		if (fs.existsSync(bin)) {
			return callback(null, bin);
		}
		return callback(new Error('metabase compile did not produce binary at ' + bin));
	});
}

function generate(input, output, callback, excludeSystemAPIs) {
	getSimulatorSDK(function (err, sdk) {
		if (err) {
			return callback(err);
		}
		getBinary(function (err, bin) {
			if (err) {
				return callback(err);
			}
			const args = [
				'-i', input,
				'-o', output,
				'-sim-sdk-path', sdk.sdkdir,
				'-min-ios-ver', sdk.version,
				'-pretty'
			];
			if (excludeSystemAPIs) {
				args.push('-x');
			}
			const child = spawn(bin, args);
			// child.stderr.on('data', function (buf) {
			// 	// process.stderr.write(buf);
			// });
			// child.stdout.on('data', function (buf) {
			// 	// process.stdout.write(buf);
			// });
			child.on('close', function (e) {
				if (e !== 0) {
					return callback(new Error('metabase generation failed'));
				}
				if (!fs.existsSync(output)) {
					return callback(new Error('metabase generation failed to generate output file'));
				}

				try {
					const buf = fs.readFileSync(output);
					// console.log(buf.toString());
					const json = JSON.parse(buf);
					callback(null, json, sdk);
				} catch (E) {
					return callback(new Error('Error parsing generated output file. ' + E.message));
				}
			});
			child.on('error', callback);
		});
	});
}

function getTempDir() {
	const tmpdir = path.join(process.env.TEMP || process.env.TMPDIR || 'tmp', '' + Math.floor(Date.now()));
	if (!fs.existsSync(tmpdir)) {
		fs.mkdirSync(tmpdir);
		tmpdirs.indexOf(tmpdir) < 0 && tmpdirs.push(tmpdir);
	}
	return tmpdir;
}

function getTempFile(fn) {
	return path.join(getTempDir(), fn);
}

function getFixture(name) {
	return path.join(__dirname, 'fixtures', name);
}

process.on('exit', function () {
	if (tmpdirs) {
		tmpdirs.forEach(tmp => {
			fs.removeSync(tmp);
		});
		tmpdirs = null;
	}
});

exports.generate = generate;
exports.getSimulatorSDK = getSimulatorSDK;
exports.getTempDir = getTempDir;
exports.getFixture = getFixture;
exports.getTempFile = getTempFile;

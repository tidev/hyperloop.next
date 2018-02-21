/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015-2018 by Appcelerator, Inc.
 */
'use strict';

const spawn = require('child_process').spawn, // eslint-disable-line security/detect-child-process
	path = require('path'),
	fs = require('fs-extra'),
	util = require('./util'),
	binary = path.join(__dirname, '..', 'bin', 'metabase');

function generateInputHeader(file, includes) {
	const contents =  '/**\n'
					+ ' * HYPERLOOP GENERATED - DO NOT MODIFY\n'
					+ ' */\n'
					+ includes.map(function (fn) {
						if (fn) {
							if (fn.charAt(0) === '<') {
								return '#import ' + fn;
							}
							return '#import "' + fn + '"';
						}
						return ''; // should never happen...
					}).join('\n')
					+ '\n';
	fs.writeFileSync(file, contents);
}

/**
 * generate a metabase
 *
 * @param {String} cacheDir cache directory to write the metabase file
 * @param {String} sdk the sdk type such as iphonesimulator
 * @param {String} sdkPath path the path to the SDK
 * @param {String} iosMinVersion the min version such as 9.0
 * @param {Array} includes array of header paths (should be absolute paths)
 * @param {Boolean} excludeSystem if true, will exclude any system libraries in the generated output
 * @param {generateMetabaseCallback} callback function to receive the result which will be (err, json, json_file, header_file)
 * @param {Boolean} force if true, will not use cache
 * @param {Array} extraHeaders Array of extra header search paths passed to the metabase parser
 * @param {Array} extraFrameworks Array of extra framework search paths passed to the metabase parser
 * @returns {void}
 * @deprecated Moving to generateFrameworkMetabase per-framework!
 */
function generateMetabase(cacheDir, sdk, sdkPath, iosMinVersion, includes, excludeSystem, callback, force, extraHeaders, extraFrameworks) {
	const cacheToken = util.createHashFromString(sdkPath + iosMinVersion + excludeSystem + JSON.stringify(includes));
	const prefix = 'metabase-' + iosMinVersion + '-' + sdk + '-' + cacheToken;
	const header = path.resolve(path.join(cacheDir, prefix + '.h'));
	const outfile = path.resolve(path.join(cacheDir, prefix + '.json'));

	// Foundation header always needs to be included
	const absoluteFoundationHeaderRegex = /Foundation\.framework\/Headers\/Foundation\.h$/;
	const systemFoundationHeaderRegex = /^[<"]Foundation\/Foundation\.h[>"]$/;
	const isFoundationIncluded = includes.some(function (header) {
		return systemFoundationHeaderRegex.test(header) || absoluteFoundationHeaderRegex.test(header);
	});
	if (!isFoundationIncluded) {
		includes.unshift(path.join(sdkPath, 'System/Library/Frameworks/Foundation.framework/Headers/Foundation.h'));
	}

	// check for cached version and attempt to return if found
	if (!force && fs.existsSync(header) && fs.existsSync(outfile)) {
		try {
			const json = JSON.parse(fs.readFileSync(outfile));
			json.$includes = includes;
			return callback(null, json, outfile, header, true);
		} catch (e) {
			// fall through and re-generate again
		}
	}

	force && util.logger.trace('forcing generation of metabase to', outfile);
	generateInputHeader(header, includes);

	const args = [
		'-pretty'
	];
	if (excludeSystem) {
		args.push('-x');
	}
	if (extraHeaders && extraHeaders.length > 0) {
		args.push('-hsp');
		args.push('"' + extraHeaders.join(',') + '"');
	}
	if (extraFrameworks && extraFrameworks.length > 0) {
		args.push('-fsp');
		args.push('"' + extraFrameworks.join(',') + '"');
	}
	runMetabaseBinary(header, outfile, sdkPath, iosMinVersion, args, function (err, json) {
		json.$includes = includes;
		return callback(null, json, outfile, header, false);
	});
}
/**
 * @callback generateMetabaseCallback
 * @param {Error} err
 * @param {Object} json
 * @param {String} outfile
 * @param {String} header
 * @param {boolean} fromCache whether we grabbed from cache or generated
 */

/**
 * [generateFrameworkMetabase description]
 * @param  {String}   cacheDir output directory
 * @param  {String}   sdkPath path to iOS SDK to use
 * @param  {String}   iosMinVersion i.e. '9.0'
 * @param  {Object}   framework framework metadata
 * @param  {String}   framework.name display name of the framework
 * @param  {String}   framework.path absolute path to the framework
 * @param  {String}   framework.umbrellaHeader absolute path to the umbrella header of the framework
 * @param  {generateMetabaseCallback} callback  [description]
 * @return {void}             [description]
 */
function generateFrameworkMetabase(cacheDir, sdkPath, iosMinVersion, framework, callback) {
	const force = false; // FIXME Allow passing this in?
	const cacheToken = util.createHashFromString(framework.path);
	const prefix = 'metabase-' + framework.name + '-' + cacheToken;
	const header = path.resolve(path.join(cacheDir, prefix + '.h'));
	const outfile = path.resolve(path.join(cacheDir, prefix + '.json'));
	const includes = [ framework.umbrellaHeader ];

	// check for cached version and attempt to return if found
	if (!force && fs.existsSync(header) && fs.existsSync(outfile)) {
		try {
			const json = JSON.parse(fs.readFileSync(outfile));
			json.$includes = includes;
			return callback(null, json, outfile, header, true);
		} catch (e) {
			// fall through and re-generate again
		}
	}

	force && util.logger.trace('forcing generation of metabase to', outfile);
	generateInputHeader(header, includes);

	const args = [
		'-framework', framework.path,
		'-pretty'
	];
	runMetabaseBinary(header, outfile, sdkPath, iosMinVersion, args, function (err, json) {
		json.$includes = includes;
		return callback(null, json, outfile, header, false);
	});
}

/**
 * [runMetabaseBinary description]
 * @param  {String}   header input header file absolue path
 * @param  {String}   outfile output file (JSON) absolute path
 * @param  {String}   sdkPath path to iOS SDK to use
 * @param  {String}   iosMinVersion i.e. '9.0'
 * @param  {String[]} extraArgs extra command lien arguments to pass to binary
 * @param  {runMetabaseBinaryCallback} callback  [description]
 * @return {void}             [description]
 */
function runMetabaseBinary(header, outfile, sdkPath, iosMinVersion, extraArgs, callback) {
	let args = [
		'-i', path.resolve(header),
		'-o', path.resolve(outfile),
		'-sim-sdk-path', sdkPath,
		'-min-ios-ver', iosMinVersion
	];
	args = args.concat(extraArgs);
	util.logger.trace('running', binary, 'with', args.join(' '));
	const ts = Date.now();
	let triedToFixPermissions = false;
	(function runMetabase(binary, args) {
		let child;
		try {
			child = spawn(binary, args);
		} catch (e) {
			if (e.code === 'EACCES') {
				if (!triedToFixPermissions) {
					fs.chmodSync(binary, '755');
					triedToFixPermissions = true;
					return runMetabase(binary, args);
				} else {
					return callback(new Error('Incorrect permissions for metabase binary ' + binary + '. Could not fix permissions automatically, please make sure it has execute permissions by running: chmod +x ' + binary));
				}
			}

			throw e;
		}
		child.stdout.on('data', function (buf) {
			util.logger.debug(String(buf).replace(/\n$/, ''));
		});
		child.stderr.on('data', function () {
			// Without this, for whatever reason, the metabase parser never returns
		});
		child.on('error', callback);
		child.on('exit', function (ex) {
			util.logger.trace('metabase took', (Date.now() - ts), 'ms to generate');
			if (ex) {
				return callback(new Error('Metabase generation failed'));
			}
			const json = JSON.parse(fs.readFileSync(outfile));
			return callback(null, json);
		});
	}(binary, args));
}
/**
 * @callback runMetabaseBinaryCallback
 * @param {Error} err
 * @param {Object} json generated metabase
 */

/**
 * Merges two metabase objects
 * @param  {Object} a Target metabase. This is the one that gets modified!
 * @param  {Object} b Source metabase. This is the one whose values/entries get copied over!
 * @return {Object}  modified version of first metabase argument
 */
function merge(a, b) {
	// simplified merge metabase json
	[ 'typedefs', 'classes', 'structs', 'blocks', 'enums', 'functions', 'unions', 'vars' ].forEach(function (k) {
		if (k in b) {
			Object.keys(b[k]).forEach(function (kk) {
				if (!(kk in a)) {
					a[kk] = b[kk];
				}
			});
		}
	});
	return a;
}

// public API
exports.merge = merge;
exports.generateFrameworkMetabase = generateFrameworkMetabase;
exports.generateMetabase = generateMetabase;

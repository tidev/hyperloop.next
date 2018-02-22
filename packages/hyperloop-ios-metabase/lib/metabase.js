/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015-2018 by Appcelerator, Inc.
 */
'use strict';

const spawn = require('child_process').spawn, // eslint-disable-line security/detect-child-process
	path = require('path'),
	fs = require('fs-extra'),
	async = require('async'),
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
 * [recursiveReadDir description]
 * @param  {string} dir path to directory to traverse
 * @param  {string[]} result accumulator for recursive calls
 * @return {string[]}
 */
function recursiveReadDir(dir, result) {
	result = result || [];
	const files = fs.readdirSync(dir);
	files.forEach(fn => {
		const fp = path.join(dir, fn);
		if (fs.statSync(fp).isDirectory()) {
			recursiveReadDir(fp, result);
		} else {
			result.push(fp);
		}
	});
	return result;
}

/**
 * for an array of directories, return all valid header files
 *
 * @param  {string[]} directories [description]
 * @return {[type]}             [description]
 */
function getAllHeaderFiles(directories) {
	const files = [];
	directories.forEach(dir => {
		recursiveReadDir(dir).forEach(fn => {
			if (/\.(h(pp)?|swift)$/.test(fn)) {
				files.push(fn);
			}
		});
	});
	return files;
}

/**
 * Iterates over a framework's Headers directory and any nested frameworks to
 * collect the paths to all available header files of a framework.
 *
 * @param {String} frameworkHeadersPath Full path to the framework's umbrella header file/directory
 * @return {string[]} List with paths to all found header files
 */
function collectFrameworkHeaders(frameworkHeadersPath) {
	const stats = fs.statSync(frameworkHeadersPath);
	if (stats.isFile()) { // umbrella header file
		return [ frameworkHeadersPath ];
	} else if (stats.isDirectory()) { // umbrella header directory
		return getAllHeaderFiles([ frameworkHeadersPath ]);
	}
	return [];
}

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
	const includes = collectFrameworkHeaders(framework.umbrellaHeader);

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
	const topLevelKeys = [ 'blocks', 'classes', 'enums', 'functions', 'protocols', 'structs', 'typedefs', 'unions', 'vars' ];
	topLevelKeys.forEach(function (topLevelKey) {
		if (topLevelKey in b) {
			Object.keys(b[topLevelKey]).forEach(function (subkey) {
				const topLevelA = a[topLevelKey] || {};
				if (!(subkey in topLevelA)) {
					topLevelA[subkey] = b[topLevelKey][subkey];
					a[topLevelKey] = topLevelA;
				}
			});
		}
	});
	return a;
}

/**
 * [extractFrameworksFromDependencies description]
 * @param  {string[]} headers [description]
 * @return {Set<string>}         [description]
 */
function extractFrameworksFromDependencies(headers) {
	const frameworks = new Set();
	headers.forEach(file => {
		const index = file.indexOf('.framework');
		if (index !== -1) {
			const frameworkName = file.substring(file.lastIndexOf('/', index) + 1, index);
			frameworks.add(frameworkName);
		}
	});
	return frameworks;
}

/**
 * Given the map of all frameworks, and an array of framework names that we
 * explicitly depend upon, generate a unified metabase from those frameworks
 * plus all of their dependencies.
 * @param  {string} cacheDir cache dir to place metabase JSON files
 * @param  {string} sdkPath path to ios sdk to use
 * @param  {string} minVersion minimum iOS version, i.e. '9.0'
 * @param  {Map<string,ModuleMetadata>}   frameworkMap map of all frameworks
 * @param  {string[]}   frameworksToGenerate array of framework names we need to include
 * @param  {runMetabaseBinaryCallback} callback async callback function
 */
function unifiedMetabase(cacheDir, sdkPath, minVersion, frameworkMap, frameworksToGenerate, callback) {
	let metabase = {};
	const frameworksDone = [];

	async.whilst(
		function () { return frameworksToGenerate.length > 0; },
		function (next) {
			const frameworkToGenerate = frameworksToGenerate.shift();
			const framework = frameworkMap.get(frameworkToGenerate);
			// TODO: Can we generate multiple at once async? Basically grab the full set to do and do them each in parallel?

			// TODO: God damn it, why do we have to keep passing cache dir, sdk path, min ios version around?
			// Can't we just bake this into the ModuleMetadata object and be done with it?
			generateFrameworkMetabase(cacheDir, sdkPath, minVersion, framework, function (err, json) {
				// we should have a metabase just for this framework now, if we could find such a framework!
				metabase = merge(metabase, json); // merge in to a single "metabase"

				const dependentHeaders = json.metadata.dependencies;
				// extract the frameworks from dependencies!
				const dependentFrameworks = extractFrameworksFromDependencies(dependentHeaders);
				dependentFrameworks.forEach(dependency => {
					// Add to our todo list if we haven't already done it and it's not already on our todo list
					if (!frameworksDone.includes(dependency) && !frameworksToGenerate.includes(dependency)) {
						frameworksToGenerate.push(dependency);
					}
				});
				next();
			});
		},
		function (err) {
			if (err) {
				return callback(err);
			}
			return callback(null, metabase);
		}
	);
}

// public API
exports.merge = merge;
exports.generateFrameworkMetabase = generateFrameworkMetabase;
exports.generateMetabase = generateMetabase; // TODO: Remove!
exports.unifiedMetabase = unifiedMetabase;

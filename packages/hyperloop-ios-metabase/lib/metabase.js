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
 * @param  {SDKEnvironment} sdk sdk info object
 * @param  {String}   sdk.sdkPath path to iOS SDK to use
 * @param  {String}   sdk.minVersion i.e. '9.0'
 * @param  {Object}   framework framework metadata
 * @param  {String}   framework.name display name of the framework
 * @param  {String}   framework.path absolute path to the framework
 * @param  {String}   framework.umbrellaHeader absolute path to the umbrella header of the framework
 * @param  {generateMetabaseCallback} callback  [description]
 * @return {void}             [description]
 */
function generateFrameworkMetabase(cacheDir, sdk, framework, callback) {
	// TODO Move this to module_metadata#generateMetabase
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
			util.logger.trace('Returning cached metabase from', outfile);
			return callback(null, json, outfile, header, true);
		} catch (e) {
			// fall through and re-generate again
		}
	}

	util.logger.trace('Generating metabase to', outfile);
	if (!fs.existsSync(cacheDir)) {
		fs.ensureDirSync(cacheDir);
	}
	generateInputHeader(header, includes);

	const args = [
		'-framework', framework.path,
		'-pretty'
	];
	runMetabaseBinary(header, outfile, sdk.sdkPath, sdk.minVersion, args, function (err, json) {
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
 * @param  {String[]} extraArgs extra command line arguments to pass to binary
 * @param  {runMetabaseBinaryCallback} callback  [description]
 * @return {void}             [description]
 */
function runMetabaseBinary(header, outfile, sdkPath, iosMinVersion, extraArgs, callback) {
	const args = [
		'-i', path.resolve(header),
		'-o', path.resolve(outfile),
		'-sim-sdk-path', sdkPath,
		'-min-ios-ver', iosMinVersion
	].concat(extraArgs);

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
 * Given an array of framework names used, deeply get the set of all frameworks necessary.
 * This is done as a side-effect, collecting the full set in the done parameter.
 * I couldn't figure out how to nicely return the full set as teh actual return value :(
 * @param  {string}   cacheDir   [description]
 * @param  {SDKEnvironment}   sdk        [description]
 * @param  {Map<string, ModuleMetadata>}   frameworks [description]
 * @param  {string[]}   toGet      [description]
 * @param  {Set<string>} done frameworks we've done or are in process
 * @return {Promise<Set<string>>}
 */
function getDependencies(cacheDir, sdk, frameworks, toGet, done) {
	return Promise.all(toGet.map(name => {
		done.add(name); // we're in process so don't do again!
		const framework = frameworks.get(name);
		return framework.getDependencies(cacheDir, sdk)
			.then(dependencySet => {
				const deps = Array.from(dependencySet);
				const filtered = deps.filter(d => { // filter out any we are already getting/got/in-process!
					return !toGet.includes(d) && !done.has(d);
				});
				if (filtered.length === 0) {
					return Promise.resolve();
				}
				return getDependencies(cacheDir, sdk, frameworks, filtered, done);
			});
	}));
}

/**
 * Given the map of all frameworks, and an array of framework names that we
 * explicitly depend upon, generate a unified metabase from those frameworks
 * plus all of their dependencies.
 * @param  {string} cacheDir cache dir to place metabase JSON files
 * @param  {SDKEnvironment} sdk sdk info object
 * @param  {string} sdk.sdkPath path to ios sdk to use
 * @param  {string} sdk.minVersion minimum iOS version, i.e. '9.0'
 * @param  {Map<string,ModuleMetadata>}   frameworkMap map of all frameworks
 * @param  {string[]}   frameworksToGenerate array of framework names we need to include
 * @returns {Promise<object>} the unified metabase object/JSON
 */
function unifiedMetabase(cacheDir, sdk, frameworkMap, frameworksToGenerate) {
	const start = Date.now();
	const done = new Set(); // this is used to gather the full set of dependencies
	return getDependencies(cacheDir, sdk, frameworkMap, frameworksToGenerate, done)
		.then(() => {
			const deepFrameworks = Array.from(done).map(name => {
				return frameworkMap.get(name);
			});
			const promises = deepFrameworks.map(framework => {
				return framework.generateMetabase(cacheDir, sdk);
			});
			return Promise.all(promises);
		})
		.then(metabases => {
			let metabase = {};
			// merge all the metabases
			metabases.forEach(json => {
				metabase = merge(metabase, json); // merge in to a single "metabase"
			});
			util.logger.trace(`Took ${Date.now() - start}ms to generate unified metabase from frameworks: ${JSON.stringify(frameworksToGenerate)}`);
			return Promise.resolve(metabase);
		});
}

// public API
exports.merge = merge;
exports.generateFrameworkMetabase = generateFrameworkMetabase; // for testing and ModuleMetadata.generateMetabase
exports.unifiedMetabase = unifiedMetabase;

/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015-2018 by Appcelerator, Inc.
 */
'use strict';

const spawn = require('child_process').spawn; // eslint-disable-line security/detect-child-process
const path = require('path');
const fs = require('fs-extra');

const util = require('./util');

const BINARY = path.join(__dirname, '..', 'bin', 'metabase');

/**
 * @param  {string} file output file
 * @param  {string[]} includes set of headers to include
 * @return {Promise}
 */
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
	return fs.writeFile(file, contents);
}

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
 * @return {Promise<object>}
 */
function generateFrameworkMetabase(cacheDir, sdk, framework) {
	const includes = framework.getHeaders();
	const cacheToken = util.createHashFromString(framework.path);
	const prefix = `metabase-${framework.name}-${cacheToken}`;
	const outfile = path.resolve(path.join(cacheDir, prefix + '.json'));

	return fs.readJson(outfile)
		.then(json => {
			json.$includes = includes;
			return json;
		})
		// generate metabase (we haven't before or it got corrupted)
		.catch(() => {
			const header = path.resolve(path.join(cacheDir, prefix + '.h'));
			// must chain on the ensureDir call itself. If we chain one level higher (on this catch) it will always execute (meaning we'll generate a metabase when we read the cached one!)
			return fs.ensureDir(cacheDir)
				.then(() => generateInputHeader(header, includes))
				.then(() => {
					const args = [
						'-framework', framework.path,
						'-pretty'
					];
					return runMetabaseBinary(header, outfile, sdk.sdkPath, sdk.minVersion, args)
						.then(json => {
							json.$includes = includes;
							return Promise.resolve(json);
						});
				});
		});
}

/**
 * Base level execution of the metabase binary.
 * @param  {string[]} args   arguments to pass to binary
 * @return {Promise}
 */
function execute(args) {
	return new Promise((resolve, reject) => {
		const child = spawn(BINARY, args);
		child.stdout.on('data', buf => {
			util.logger.debug(String(buf).replace(/\n$/, ''));
		});
		child.stderr.on('data', () => {}); // Without this, for whatever reason, the metabase parser never returns
		child.on('error', err => reject(err));
		child.on('exit', ex => {
			if (ex) {
				return reject(new Error('Metabase generation failed'));
			}
			return resolve();
		});
	});
}

/**
 * [runMetabaseBinary description]
 * @param  {String}   header input header file absolue path
 * @param  {String}   outfile output file (JSON) absolute path
 * @param  {String}   sdkPath path to iOS SDK to use
 * @param  {String}   iosMinVersion i.e. '9.0'
 * @param  {String[]} extraArgs extra command line arguments to pass to binary
 * @return {Promise<object>} generated json/metabase
 */
function runMetabaseBinary(header, outfile, sdkPath, iosMinVersion, extraArgs) {
	const args = [
		'-i', path.resolve(header),
		'-o', path.resolve(outfile),
		'-sim-sdk-path', sdkPath,
		'-min-ios-ver', iosMinVersion
	].concat(extraArgs);

	return execute(args)
		.catch(err => {
			// if first time we get issue with access, try and chmod the binary and try again
			if (err.code === 'EACCES') {
				fs.chmodSync(BINARY, '755');
				return execute(args);
			}
			return Promise.reject(err);
		})
		// if we failed again for access, give more useful error message about running chmod
		.catch(err => {
			if (err.code === 'EACCES') {
				return Promise.reject(new Error(`Incorrect permissions for metabase binary ${BINARY}. Could not fix permissions automatically, please make sure it has execute permissions by running: chmod +x ${BINARY}`)); // eslint-disable-line max-len
			}
			return Promise.reject(err);
		})
		// if we succeed, read the output and return it
		.then(() => fs.readJson(outfile));
}

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
 * @param  {SDKEnvironment}   sdk        [description]
 * @param  {Map<string, ModuleMetadata>}   frameworks [description]
 * @param  {string[]}   toGet      [description]
 * @param  {Set<string>} done frameworks we've done or are in process
 * @return {Promise<Set<string>>}
 */
function getDependencies(sdk, frameworks, toGet, done) {
	return Promise.all(toGet.map(name => {
		done.add(name); // we're in process so don't do again!
		const framework = frameworks.get(name);
		return framework.getDependencies(sdk)
			.then(dependencySet => {
				const deps = Array.from(dependencySet);
				const filtered = deps.filter(d => { // filter out any we are already getting/got/in-process!
					return !toGet.includes(d) && !done.has(d);
				});
				if (filtered.length === 0) {
					return Promise.resolve();
				}
				return getDependencies(sdk, frameworks, filtered, done);
			});
	}));
}

/**
 * Given the map of all frameworks, and an array of framework names that we
 * explicitly depend upon, generate a unified metabase from those frameworks
 * plus all of their dependencies.
 * @param  {SDKEnvironment} sdk sdk info object
 * @param  {string} sdk.sdkPath path to ios sdk to use
 * @param  {string} sdk.minVersion minimum iOS version, i.e. '9.0'
 * @param  {Map<string,ModuleMetadata>}   frameworkMap map of all frameworks
 * @param  {string[]}   frameworksToGenerate array of framework names we need to include
 * @returns {Promise<object>} the unified metabase object/JSON
 */
function unifiedMetabase(sdk, frameworkMap, frameworksToGenerate) {
	const done = new Set(); // this is used to gather the full set of dependencies
	return getDependencies(sdk, frameworkMap, frameworksToGenerate, done)
		.then(() => {
			const deepFrameworks = Array.from(done).map(name => frameworkMap.get(name));
			const promises = deepFrameworks.map(framework => framework.generateMetabase(sdk));
			return Promise.all(promises);
		})
		.then(metabases => {
			let metabase = {};
			// merge all the metabases
			metabases.forEach(json => {
				metabase = merge(metabase, json); // merge in to a single "metabase"
			});
			return Promise.resolve(metabase);
		});
}

// public API
exports.merge = merge;
exports.generateFrameworkMetabase = generateFrameworkMetabase; // for testing and ModuleMetadata.generateMetabase
exports.unifiedMetabase = unifiedMetabase;

'use strict';

const path = require('path');
const fs = require('fs-extra');
const ModuleMetadata = require('./module_metadata').ModuleMetadata;

// /**
// * @callback moduleMapCallback
// * @param {Error} err
// * @param {Map<string, ModuleMetadata>} frameworks
// */
//
// /**
// * @callback workCallback
// * @param {moduleMapCallback} next
// */
//
// /**
//  * Reads from cache if exists and calls callback with result. Otherwise delegates to work callback function to calculate the module set.
//  * Then writes the result to cache and then calls the callback.
//  * @param  {string}   cachePathAndFilename cache file to use
//  * @param  {workCallback}   work  The work to be done if not cached. Receives a 'next' param, which is a callback function itself
//  * @param  {moduleMapCallback} callback The ultimate callback
//  * @returns {void}
//  */
// function smartCaching(cachePathAndFilename, work, callback) {
// 	const cachedMetadata = readModulesMetadataFromCache(cachePathAndFilename);
// 	if (cachedMetadata !== null) {
// 		return callback(null, cachedMetadata);
// 	}
//
// 	work(function (err, result) {
// 		if (err) {
// 			return callback(err);
// 		}
// 		writeModulesMetadataToCache(result, cachePathAndFilename);
// 		callback(null, result);
// 	});
// }

/**
 * Takes a Map of names to ModuleMetadata and writes it out to a cache file as JSON
 * @param  {Map<string, ModuleMetadata>} modules modules to write to cache
 * @param  {String} cachePathAndFilename absolute path to cache file to write
 * @return {void}
 */
function writeModulesMetadataToCache(modules, cachePathAndFilename) {
	const modulesObject = {};
	modules.forEach((entry, key) => {
		if (entry instanceof ModuleMetadata) {
			modulesObject[entry.name] = entry.toJson();
		}
		if (key === '$metadata') {
			modulesObject.$metadata = entry;
		}
	});
	const cacheDir = path.dirname(cachePathAndFilename);
	if (!fs.existsSync(cacheDir)) {
		fs.mkdirSync(cacheDir);
	}
	fs.writeFileSync(cachePathAndFilename, JSON.stringify(modulesObject));
}

/**
 * @param  {String} cachePathAndFilename absolute path to cached file
 * @return {Map<string, ModuleMetadata>}
 */
function readModulesMetadataFromCache(cachePathAndFilename) {
	if (!fs.existsSync(cachePathAndFilename)) {
		return null;
	}

	let json = {};
	try {
		json = JSON.parse(fs.readFileSync(cachePathAndFilename));
	} catch (e) {
		return null;
	}

	const modules = new Map();
	Object.keys(json).forEach(entryName => {
		if (entryName === '$metadata') {
			modules.set('$metadata', json[entryName]);
			return;
		}

		modules.set(entryName, ModuleMetadata.fromJson(json[entryName]));
	});

	return modules;
}

exports.readModulesMetadataFromCache = readModulesMetadataFromCache; // for cocoapods and frameworks
exports.writeModulesMetadataToCache = writeModulesMetadataToCache; // for cocopods and frameworks
// exports.smartCaching = smartCaching;

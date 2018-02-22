// TODO: Make into an incremental appc-task!
'use strict';
const fs = require('fs-extra');
const async = require('async');
const hm = require('hyperloop-metabase');

// TODO Take in the list of used frameworks/references...
// We already should have generated their metabases on disk...
// Combine them into a single unified object?
// Look at their dependencies and ensure we also generate metabases for them?
// Generate a framework/metabase for the swift sources?
// Generate the builtins metabase?
//

// Next step is to generate sources from the unified metabase plus reference info
// What do we need for that?
// - unified metabase object
// - output dir
// - parser state? seems to act as the references info...

/**
 * [generateMetabase description]
 * @param  {string}   buildDir   path to directory where metabase json files will be cached
 * @param  {string} sdkPath path to iOS SDK
 * @param  {string} minVersion minimum iOS version, i.e. '9.0'
 * @param  {string} sdkType 'iphoneos' || 'iphonesimulator'
 * @param  {Map<string,ModuleMetadata>}   frameworkMap [description]
 * @param  {string[]} usedFrameworkNames list of explicitly used frameworks
 * @param  {object[]} swiftSources array of swift source file metadata
 * @param  {Object}   logger     [description]
 * @param  {Function} callback   [description]
 * @return {void}
 */
function generateMetabase(buildDir, sdkPath, minVersion, sdkType, frameworkMap, usedFrameworkNames, swiftSources, logger, callback) {
	fs.ensureDirSync(buildDir);

	// Loop through swift sources and group by framework name!
	const swiftFrameworks = new Map();
	swiftSources.forEach(entry => {
		let files = [];
		if (swiftFrameworks.has(entry)) {
			files = swiftFrameworks.get(entry.framework);
		}
		files.push(entry.source);
		swiftFrameworks.set(entry.framework, files);
	});
	const swiftFrameworkNames = Array.from(swiftFrameworks.keys());

	// FIXME: Shouldn't we be generating swift frameworks earlier when we gather other frameworks?
	// Then we can just treat them like any other frameworks here and just call unifiedMetabase on the set of system/user/3rd-party/swift frameworks
	let masterMetabase = {};
	hm.metabase.unifiedMetabase(buildDir, sdkPath, minVersion, frameworkMap, usedFrameworkNames, (err, metabase) => {
		if (err) {
			return callback(err);
		}
		masterMetabase = metabase;

		// Now do swift metabases
		const swiftMetabases = [];
		// TODO: Can we generate a ModuleMetadata equivalent for this Swift source framework?
		async.each(swiftFrameworkNames, (name, next) => {
			const swiftFiles = swiftFrameworks.get(name);
			// logger.info('Generating metabase for swift framework ' + chalk.cyan(name + ' ' + swiftFiles));
			hm.swift.generateSwiftFrameworkMetabase(name, frameworkMap, buildDir, sdkPath, minVersion, sdkType, swiftFiles, (err, swiftMetabase) => {
				if (err) {
					return next(err);
				}

				swiftMetabases.push(swiftMetabase);
				next();
			});
		}, err => {
			if (err) {
				return callback(err);
			}

			// Merge the swift metabases into the master one from system/etc frameworks.
			swiftMetabases.forEach(swiftMetabase => {
				masterMetabase = hm.metabase.merge(masterMetabase, swiftMetabase);
			});

			// OK we've merged them all together!
			callback(null, masterMetabase);
		});
	});
}

exports.generateMetabase = generateMetabase;

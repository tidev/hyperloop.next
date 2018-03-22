// TODO: Make into an incremental appc-task!
'use strict';
const fs = require('fs-extra');
const hm = require('hyperloop-metabase');

/**
 * Generates a full/unified metabase from all used frameworks, their dependencies and swift sources.
 * @param  {string}   buildDir   path to directory where metabase json files will be cached
 * @param  {SDKEnvironment} sdk sdk info object
 * @param  {string} sdk.sdkPath path to iOS SDK
 * @param  {string} sdk.minVersion minimum iOS version, i.e. '9.0'
 * @param  {string} sdk.sdkType 'iphoneos' || 'iphonesimulator'
 * @param  {Map<string,ModuleMetadata>}   frameworkMap [description]
 * @param  {string[]} usedFrameworkNames list of explicitly used frameworks
 * @param  {object[]} swiftSources array of swift source file metadata
 * @return {Promise<object>}
 */
function generateMetabase(buildDir, sdk, frameworkMap, usedFrameworkNames, swiftSources) {
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
	return hm.metabase.unifiedMetabase(buildDir, sdk, frameworkMap, usedFrameworkNames)
		.then(metabase => {
			masterMetabase = metabase;

			const swiftMetabasePromises = swiftFrameworkNames.map(name => {
				const swiftFiles = swiftFrameworks.get(name);
				return hm.swift.generateSwiftFrameworkMetabase(name, frameworkMap, buildDir, sdk, swiftFiles);
			});
			return Promise.all(swiftMetabasePromises);
		})
		.then(swiftMetabases => {
			// Merge the swift metabases into the master one from system/etc frameworks.
			swiftMetabases.forEach(swiftMetabase => {
				masterMetabase = hm.metabase.merge(masterMetabase, swiftMetabase);
			});
			return Promise.resolve(masterMetabase);
		});
}

exports.generateMetabase = generateMetabase;

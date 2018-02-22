// TODO: Make into an incremental appc-task!
'use strict';
const fs = require('fs-extra');
const chalk = require('chalk');
const async = require('async');
const HL = chalk.magenta.inverse('Hyperloop');
const StopHyperloopCompileError = require('../lib/error');
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
 * @param  {Map<string,ModuleMetadata>}   usedFrameworks [description]
 * @param  {Object}   logger     [description]
 * @param  {Function} callback   [description]
 * @return {void}
 */
function generateMetabase(buildDir, usedFrameworks, logger, callback) {
	// no hyperloop files detected, we can stop here
	if (!this.includes.length && !Object.keys(this.references).length) {
		logger.info('Skipping ' + HL + ' compile, no usage found ...');
		return callback(new StopHyperloopCompileError());
	}

	fs.ensureDirSync(buildDir);

	// Do we have an umbrella header for every framework?
	usedFrameworks.forEach(frameworkMeta => {
		if (!frameworkMeta.umbrellaHeader || !fs.existsSync(frameworkMeta.umbrellaHeader)) {
			logger.warn(`Unable to detect framework umbrella header for ${frameworkMeta.name}.`);
		}
	});

	// TODO We actually should already have metabases generated for each framework...
	// But we should go through the list of used frameworks and generate metabases for their dependencies?

	// TODO We already are generating metabases on the fly...
	// Maybe here we generate metabases of any dependencies of used frameworks? Or somehow traverse the used set and add dependencies to it?
	//
	// Looks like it also does some swift metabase generation....
	// Can we gather the full set of swift sources and treat them as another "framework"?
	// It looks like we gather the set of imports from the swift files and generate metabases for them
	// merge it all together and then stuff classes from the swift file into the metabase
	//
	// So in a way we're treating each swift source file as a "framework" right now
	// I'd prefer to treat the full set as one framework that we generate a metabase for
	// And then possibly any dependency frameworks should get their metabases generated as well?

	let metabase = {};
	async.each();

	const frameworks = [];
	usedFrameworks.forEach(framework => {
		frameworks.push(framework);
	});

	async.eachSeries(frameworks, function (framework, next) {
		hm.metabase.generateFrameworkMetabase(buildDir, sdkPath, minVersion, framework, function (err, json) {
			// we should have a metabase just for this framework now, if we could find such a framework!
			metabase = hm.metabase.merge(metabase, json); // merge in to a single "metabase"
			next();
		});
	}, function (err) {
		if (err) {
			return callback(err);
		}

		hm.swift.generateSwiftFrameworkMetabase(usedFrameworks, sdkPath, minVersion, sdkType, switfSources, (err, json) => {

		});

		// Done merging metabases!
		// FIXME This assumes generation of a single metabase that includes all dependencies
		// We should really treat the full set of swift files as a single "framework" that gets one metabase generated (or keep the metabase-per-file approach)
		// And any system/3rd-party dependencies just get reported in metadata not built into the same metabase file!

		// this has to be serial because each successful call to generateSwiftMetabase() returns a
		// new metabase object that will be passed into the next file
		async.eachSeries(this.swiftSources, function (entry, cb) {
			logger.info('Generating metabase for swift ' + chalk.cyan(entry.framework + ' ' + entry.source));
			hm.swift.generateSwiftMetabase(
				buildDir,
				sdkType,
				sdkPath,
				minVersion,
				this.builder.xcodeTargetOS,
				metabase,
				entry.framework,
				entry.source,
				function (err, result, newMetabase) {
					if (!err) {
						metabase = newMetabase;
					} else if (result) {
						logger.error(result);
					}
					cb(err);
				}
			);
		}.bind(this), function (err) {
			if (err) {
				return callback(err);
			}
			callback(null, metabase);
		});
	});
}

exports.generateMetabase = generateMetabase;

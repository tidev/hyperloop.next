'use strict';

const spawn = require('child_process').spawn, // eslint-disable-line security/detect-child-process
	path = require('path'),
	fs = require('fs-extra'),
	chalk = require('chalk'),
	util = require('./util');

/**
 * [runTool description]
 * @param  {string} name   short name of binary (for logs)
 * @param  {string} binary binary name to actually execute
 * @param  {string} runDir path to working dir to use for process
 * @param  {string[]} args   [description]
 * @return {Promise}
 */
function runTool(name, binary, runDir, args) {
	return new Promise((resolve, reject) => {
		const child = spawn(`/usr/bin/${binary}`, args, { cwd: runDir });
		util.logger.debug(`running /usr/bin/${name} ${args.join(' ')} ${runDir}`);
		util.prefixOutput(name, child.stdout, util.logger.trace);
		util.prefixOutput(name, child.stderr, util.logger.warn);
		child.on('error', err => reject(err));
		child.on('exit', ec => {
			if (ec !== 0) {
				return reject(new Error(`the ${name} failed running from ${runDir}`));
			}
			resolve();
		});
	});
}

/**
 * run the ibtool
 * @param {String} runDir absolute path to cwd to run inside
 * @param {string[]} args command line arguments
 * @return {Promise}
 */
function runIBTool(runDir, args) {
	return runTool('ibtool', 'ibtool', runDir, args);
}

function runMomcTool(runDir, sdk, args) {
	return runTool('xcrun momc', 'xcrun', runDir, [ '--sdk', sdk, 'momc' ].concat(args));
}

function runMapcTool(runDir, sdk, args) {
	return runTool('xcrun mapc', 'xcrun', runDir, [ '--sdk', sdk, 'mapc' ].concat(args));
}

/**
 * Recursively gathers files under a directory
 * @param  {String} dir  absolute path to root directory
 * @param  {String[]} result accumulator for listing, used to build up listing recursively for sub-dirs
 * @return {String[]}
 */
function recursiveReadDir(dir, result) {
	result = result || [];
	const files = fs.readdirSync(dir);
	files.forEach(function (filename) {
		const fullPath = path.join(dir, filename);
		if (fs.statSync(fullPath).isDirectory()) {
			recursiveReadDir(fullPath, result);
		} else {
			result.push(fullPath);
		}
	});
	return result;
}

/**
 * [compileResources description]
 * @param  {string}   dir      where resource is located
 * @param  {string}   sdk      i.e. 'iphonesimulator-9.0' or 'iphoneos-11.0'
 * @param  {string}   appDir   path to xcode app
 * @param  {boolean}  wildcard if true, copies source files (*.m|mm|h|cpp|hpp|c|s) to xcode app dir
 * @returns {Promise}
 */
function compileResources(dir, sdk, appDir, wildcard) {
	// copy them into our target
	const files = recursiveReadDir(dir);
	const promises = files.map(file => {
		const rel = path.basename(path.relative(dir, file));

		switch (path.extname(rel)) {
			case '.xib': {
				const args = [
					'--reference-external-strings-file',
					'--errors',
					'--output-format', 'binary1',
					'--compile', path.join(appDir, rel.replace(/\.xib$/, '.nib')),
					'--sdk', sdk,
					file
				];
				return runIBTool(path.dirname(file), args);
			}
			case '.xcdatamodel': {
				const args = [
					file,
					path.join(appDir, rel.replace(/\.xcdatamodel$/, '.mom'))
				];
				return runMomcTool(path.dirname(file), sdk, args);
			}
			case '.xcdatamodeld': {
				const args = [
					file,
					path.join(appDir, rel.replace(/\.xcdatamodeld$/, '.momd'))
				];
				return runMomcTool(path.dirname(file), sdk, args);
			}
			case '.xcmappingmodel': {
				const args = [
					file,
					path.join(appDir, rel.replace(/\.xcmappingmodel$/, '.cdm'))
				];
				return runMapcTool(path.dirname(file), sdk, args);
			}
			case '.xcassets': {
				// FIXME: Throw an error to at least to show we don't yet handle this?
				return Promise.resolve();
			}
			case '.storyboard': {
				const args = [
					'--reference-external-strings-file',
					'--errors',
					'--output-format', 'binary1',
					'--compile', path.join(appDir, rel.replace(/\.storyboard$/, '.storyboardc')),
					'--sdk', sdk,
					file
				];
				return runIBTool(path.dirname(file), args);
			}
			default: {
				if (wildcard && !/\.(m|mm|h|cpp|hpp|c|swift)$/.test(file)) {
					return new Promise((resolve, reject) => {
						const buf = fs.readFileSync(file);
						const out = path.join(appDir, rel);
						const d = path.dirname(out);

						fs.ensureDirSync(d);
						util.logger.trace('Copying Resource', chalk.cyan(file), 'to', chalk.cyan(out));

						fs.writeFile(out, buf, function (err) {
							if (err) {
								return reject(err);
							}
							resolve();
						});
					});
				}
				return Promise.resolve();
			}
		}
	});
	return Promise.all(promises);
}

exports.compileResources = compileResources; // used by hyperloop hook and third_party_frameworks.js

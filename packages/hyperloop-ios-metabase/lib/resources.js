'use strict';

const spawn = require('child_process').spawn, // eslint-disable-line security/detect-child-process
	path = require('path'),
	fs = require('fs-extra'),
	async = require('async'), // TODO Move to Promises
	chalk = require('chalk'),
	util = require('./util');

/**
 * run the ibtool
 * @param {String} runDir absolute path to cwd to run inside
 * @param {string[]} args command line arguments
 * @param {Function} callback callback function
 */
function runIBTool(runDir, args, callback) {
	var child = spawn('/usr/bin/ibtool', args, { cwd: runDir });
	util.logger.debug('running /usr/bin/ibtool ' + args.join(' ') + ' ' + runDir);
	util.prefixOutput('ibtool', child.stdout, util.logger.trace);
	util.prefixOutput('ibtool', child.stderr, util.logger.warn);
	child.on('error', callback);
	child.on('exit', function (ec) {
		if (ec !== 0) {
			return callback(new Error('the ibtool failed running from ' + runDir));
		}
		callback();
	});
}

function runMomcTool(runDir, sdk, args, callback) {
	var child = spawn('/usr/bin/xcrun', [ '--sdk', sdk, 'momc' ].concat(args), { cwd: runDir });
	util.logger.debug('running /usr/bin/xcrun momc' + args.join(' ') + ' ' + runDir);
	util.prefixOutput('xcrun momc', child.stdout, util.logger.trace);
	util.prefixOutput('xcrun momc', child.stderr, util.logger.warn);
	child.on('error', callback);
	child.on('exit', function (ec) {
		if (ec !== 0) {
			return callback(new Error('the xcrun momc failed running from ' + runDir));
		}
		callback();
	});
}

function runMapcTool(runDir, sdk, args, callback) {
	var child = spawn('/usr/bin/xcrun', [ '--sdk', sdk, 'mapc' ].concat(args), { cwd: runDir });
	util.logger.debug('running /usr/bin/xcrun mapc' + args.join(' ') + ' ' + runDir);
	util.prefixOutput('xcrun mapc', child.stdout, util.logger.trace);
	util.prefixOutput('xcrun mapc', child.stderr, util.logger.warn);
	child.on('error', callback);
	child.on('exit', function (ec) {
		if (ec !== 0) {
			return callback(new Error('the xcrun mapc failed running from ' + runDir));
		}
		callback();
	});
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
 * @param  {Function} callback async callback function
 */
function compileResources(dir, sdk, appDir, wildcard, callback) {
	// copy them into our target
	const files = recursiveReadDir(dir);
	async.each(files, function (file, cb) {
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
				return runIBTool(path.dirname(file), args, cb);
			}
			case '.xcdatamodel': {
				const args = [
					file,
					path.join(appDir, rel.replace(/\.xcdatamodel$/, '.mom'))
				];
				return runMomcTool(path.dirname(file), sdk, args, cb);
			}
			case '.xcdatamodeld': {
				const args = [
					file,
					path.join(appDir, rel.replace(/\.xcdatamodeld$/, '.momd'))
				];
				return runMomcTool(path.dirname(file), sdk, args, cb);
			}
			case '.xcmappingmodel': {
				const args = [
					file,
					path.join(appDir, rel.replace(/\.xcmappingmodel$/, '.cdm'))
				];
				return runMapcTool(path.dirname(file), sdk, args, cb);
			}
			case '.xcassets': {
				// FIXME:
				break;
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
				return runIBTool(path.dirname(file), args, cb);
			}
			default: {
				if (wildcard) {
					if (!/\.(m|mm|h|cpp|hpp|c|s)$/.test(file)) {
						const buf = fs.readFileSync(file);
						const out = path.join(appDir, rel);
						const d = path.dirname(out);

						fs.ensureDirSync(d);
						util.logger.trace('Copying Resource', chalk.cyan(file), 'to', chalk.cyan(out));

						return fs.writeFile(out, buf, cb);
					}
				}
				break;
			}
		}
		cb();
	}, callback);
}

exports.compileResources = compileResources;

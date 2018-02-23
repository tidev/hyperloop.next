/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015-2018 by Appcelerator, Inc.
 */
'use strict';

const fs = require('fs'),
	util = require('./util'),
	async = require('async'),
	metabaselib = require('./metabase'),
	spawn = require('child_process').spawn; // eslint-disable-line security/detect-child-process

// regular expressions for dealing with Swift ASTs
const COMPONENT_RE = /component id='(.*)'/;
const PATTERN_NAMED_RE = /pattern_named type='(\w+)' '(\w+)'/;
// example:  (parameter "width" apiName=width type='CGFloat' interface type='CGFloat')
// (parameter "self" type='MyUI.Type' interface type=\'MyUI.Type\'))
const PARAMETER_RE = /parameter "(\w+)"( apiName=\w+)?( type='([A-Za-z_]\w*(\.[A-Za-z_]\w*)*)')?( interface type='(\w+)')?( mutable)?( inout)?( shared)?( variadic)?/;
const TYPE_RE = /type='(\w+)'/;
const PUBLIC_ACCESS_PATTERN = /access=(public|open)/;

/**
 * generate Swift AST output from a swift file
 * @param {String} sdkPath absolute path to the iOS SDK directory
 * @param {String} iosMinVersion i.e. '9.0'
 * @param {String} xcodeTargetOS 'iphoneos' || 'iphonesimulator'
 * @param {String} fn filename
 * @param {Function} callback callback function
 */
function generateSwiftAST(sdkPath, iosMinVersion, xcodeTargetOS, fn, callback) {
	const start = Date.now();
	const args = [ 'swiftc', '-sdk', sdkPath, '-dump-ast', fn ];
	if (xcodeTargetOS === 'iphoneos' || xcodeTargetOS === 'iphonesimulator') {
		args.push('-target');
		if (xcodeTargetOS === 'iphoneos') {
			// armv7 for all devices. Note that we also could use armv7s or arm64 here
			args.push('armv7-apple-ios' + iosMinVersion);
		} else {
			var simArch = process.arch === 'i386' ? 'i386' : 'x86_64';
			args.push(simArch + '-apple-ios' + iosMinVersion);
		}
	}
	const child = spawn('xcrun', args);
	let buf = '';
	// swiftc -sdk /Applications/Xcode.app/Contents/Developer/Platforms/iPhoneSimulator.platform/Developer/SDKs/iPhoneSimulator9.0.sdk -dump-ast MySwift.swift
	child.on('error', callback);
	child.stderr.on('data', function (data) {
		buf += data.toString();
	});
	child.on('exit', function (ec) {
		if (ec === 1) {
			return callback(new Error('Swift file at ' + fn + ' has compiler problems. Please check to make sure it compiles OK.'), buf);
		}
		util.logger.trace(`Took ${Date.now() - start}ms to generate swift AST for ${fn}`);
		callback(null, buf);
	});
}

/**
 * return an encoding for a value
 * @param {String} value a type string
 * @returns {String}
 */
function getEncodingForValue(value) {
	value = value.toLowerCase();
	switch (value) {
		case 'int': return 'i';
		case 'long': return 'l';
		case 'float': return 'f';
		case 'double': return 'd';
		case 'void': return 'v';
		case 'char': return 'c';
		case 'short': return 's';
		case 'bool': return 'B';
		case 'long_long':
		case 'long long': return 'q';
		case 'unsigned int': return 'I';
		case 'unsigned long': return 'L';
		case 'unsigned long long': return 'Q';
		case 'unsigned char': return 'C';
		case 'unsigned short': return 'S';
		case 'char *': case 'char_s': return '*';
		case 'id': return '@';
		case 'sel': return ':';
		case 'class': return '#';
	}
	return value;
}

/**
 * encode a structure
 * @param {Object} value a struct Object
 * @returns {String}
 */
function structDefinitionToEncoding(value) {
	let str = '{' + value.name + '=';
	value.fields && value.fields.forEach(function (field) {
		str += field.encoding || getEncodingForValue(field.type || field.value);
	});
	return str + '}';
}

/**
 * attempt to resolve a type object for a value
 * @param {String} filename file name
 * @param {Object} metabase generated metabase
 * @param {String} value value
 * @return {Object}
 */
function resolveType(filename, metabase, value) {
	if (util.isPrimitive(value.toLowerCase())) {
		value = value.toLowerCase();
		return {
			value: value,
			type: value,
			encoding: getEncodingForValue(value)
		};
	} else if (metabase.classes && value in metabase.classes) {
		return {
			value: value,
			type: value,
			encoding: '@'
		};
	} else if (metabase.structs && value in metabase.structs) {
		const str = metabase.structs[value];
		return {
			value: value,
			type: value,
			encoding: structDefinitionToEncoding(str)
		};
	} else if (metabase.typedefs && value in metabase.typedefs) {
		const typedef = metabase.typedefs[value];
		return { type: typedef.type, value: value, encoding: typedef.encoding };
	}
	console.error('Swift Generation failed with unknown or unsupported type (' + value + ') found while compiling', filename);
	process.exit(1);
}

/**
 * extract all the imports found in the buffer
 * @param {String} buf buffer to match against
 * @returns {String[]}
 */
function extractImports(buf) {
	// FIXME This doesn't handle specifying the type of the import. May not support UIKit.UITableViewController style either?
	return (buf.match(/import\s*(\w+)/g) || []).map(function (m) {
		return m.substring(6).replace(/;$/, '').trim();
	});
}

/**
 * return the swift managed class name for a given application and class name
 * @param {String} appName app name used as a segment in the mangled name
 * @param {String} className original class name
 * @returns {String}
 */
function generateSwiftMangledClassName(appName, className) {
	return '_TtC' + appName.length + appName + className.length + className;
}

/**
 * Parses a single swift source file and extract the classes defined within.
 * For tryign to decode AST syntax: https://github.com/apple/swift/blob/master/lib/AST/ASTDumper.cpp
 * @param  {String}   framework     name of the framework to assign this file to
 * @param  {string} fn            filename of the swift source
 * @param  {Object}   metabase      Metabase of dependencies to look up types
 * @param {String} sdkPath absolue filepath to ios SDK directory
 * @param {String} iosMinVersion i.e. '9.0'
 * @param {String} xcodeTargetOS 'iphoneos' || 'iphonesimulator'
 * @param  {Function} callback  callback function
 */
function extractSwiftClasses(framework, fn, metabase, sdkPath, iosMinVersion, xcodeTargetOS, callback) {
	generateSwiftAST(sdkPath, iosMinVersion, xcodeTargetOS, fn, function (err, buf) {
		if (err) {
			return callback(err, buf);
		}

		const lines = buf.split(/\n/);

		const classes = {};
		let classdef,
			methodef,
			vardef;

		lines.forEach(function (line, index) {
			line = line.toString().trim();
			if (line) {
				// console.log('line=>', line);
				if (line.indexOf('(class_decl ') === 0) {
					const tok = line.split(' ');
					const cls = tok[1].replace(/"/g, '').trim();
					classdef = {
						name: cls,
						public: false,
						methods: {},
						properties: {},
						filename: fn,
						thirdparty: true,
						framework: framework,
						language: 'swift'
					};
					tok.slice(2).forEach(function (t, i) {
						if (PUBLIC_ACCESS_PATTERN.test(t)) {
							classdef.public = true;
						} else if (t.indexOf('inherits:') === 0) {
							classdef.superclass = tok[i + 3]; // 2 is sliced so add + 1
						}
					});
					if (classdef.public) {
						delete classdef.public;
						classes[classdef.name] = classdef;
						metabase.classes[classdef.name] = classdef;
					} else {
						classdef = null;
					}
				} else if (line.indexOf('(var_decl') === 0 && classdef) {
					const tok = line.split(' ');
					const name = tok[1].replace(/"/g, '').trim();
					vardef = {
						name: name,
						public: false
					};
					tok.splice(2).forEach(function (t) {
						if (PUBLIC_ACCESS_PATTERN.test(t)) {
							vardef.public = true;
						} else if (t.indexOf('type=') === 0) {
							vardef.type = resolveType(fn, metabase, TYPE_RE.exec(t)[1]);
						}
					});
					if (vardef.public) {
						delete vardef.public;
						classdef.properties[name] = vardef;
					}
				} else if (line.indexOf('(func_decl ') === 0 && line.indexOf('getter_for=') < 0) {
					const tok = line.split(' ');
					const name = tok[1].replace(/"/g, '').trim();
					const i = name.indexOf('(');
					methodef = {
						name: name,
						public: false,
						instance: true
					};
					if (i) {
						methodef.name = name.substring(0, i);
						methodef.selector = methodef.name;
						methodef.arguments = [];
						name.substring(i + 1, name.length - 1).split(':').slice(1).forEach(function (t) {
							methodef.selector += ':' + t;
						});
					}
					// if the func_decl line ends in " type", it's a static function (in Swift 4)
					if (tok[tok.length - 1] === 'type') {
						// this is a class method
						methodef.instance = false;
					}

					tok.splice(2).forEach(function (t) {
						if (PUBLIC_ACCESS_PATTERN.test(t)) {
							methodef.public = true;
						} else if (t.indexOf('type=') === 0) { // old way of detecting static method (Swift 2/3?)
							if (t.indexOf('type=\'' + classdef.name + '.Type') === 0) {
								// this is a class method
								methodef.instance = false;
							}
						}
					});

					if (classdef && methodef.public) {
						delete methodef.public;
						classdef.methods[methodef.name] = methodef;
					} else {
						methodef = null;
					}
				} else if (methodef && line.indexOf('(parameter ') === 0 && PARAMETER_RE.test(line)) { // Swift 4.0 syntax for paraamters?
					const re = PARAMETER_RE.exec(line);
					const paramName = re[1];
					if (paramName !== 'self') {
						const typeName = re[4];
						const t = resolveType(fn, metabase, typeName);
						methodef.arguments.push({
							name: paramName,
							type: t
						});
					}
				} else if (methodef && line.indexOf('(pattern_named ') === 0 && PATTERN_NAMED_RE.test(line)) { // Swift 3.0 syntax for paraamters?
					const re = PATTERN_NAMED_RE.exec(line);
					const t = resolveType(fn, metabase, re[1]);
					methodef.arguments.push({
						name: re[2],
						type: t
					});
				} else if (methodef && line.indexOf('(result') === 0 && lines[index + 1].trim().indexOf('(type_ident') === 0 && lines[index + 2].trim().indexOf('(component ') === 0) {
					methodef.returns = resolveType(fn, metabase, COMPONENT_RE.exec(lines[index + 2].trim())[1]);
					methodef = null;
				}
			}
		});

		callback(null, classes);
	});
}

/**
 * Given an array of Swift source files, this will generate an in-memory metabase
 * holding the classes defined within these files.
 *
 * @param {string} name framework name to use for this bunch of swift sources
 * @param  {Map<string, ModuleMetadata>}   frameworks    [description]
 * @param {string} cacheDir place to cache generated metabases
 * @param  {string}   sdkPath       absolute path to the sdk to use
 * @param  {string}   iosMinVersion i.e. '9.0'
 * @param  {string}   xcodeTargetOS 'iphoneos' || 'iphonesimulator'
 * @param  {string[]} swiftFiles            swift source filename
 * @param  {Function} callback      typical async callback function
 * @return {void}
 */
function generateSwiftFrameworkMetabase(name, frameworks, cacheDir, sdkPath, iosMinVersion, xcodeTargetOS, swiftFiles, callback) {
	// read our imports from the file so we can generate an appropriate metabase
	const imports = new Set();
	async.each(swiftFiles, (file, next) => {
		// This only supports imports of a framework name, NOT specifying type of the import or "sub-modules"
		// FOR NOW, that is...
		extractImports(fs.readFileSync(file).toString()).forEach(i => {
			imports.add(i);
		});
		next();
	}, err => {
		if (err) {
			callback(err);
		}

		// Ok, so we know what the set of swift files imported, now let's generate a
		// deep, unified metabase from the frameworks used plus all dependencies
		metabaselib.unifiedMetabase(cacheDir, sdkPath, iosMinVersion, frameworks, Array.from(imports), (err, metabase) => {
			if (err) {
				return callback(err);
			}

			// Generate the classes in parallel, then merge them sync at the end!
			// dumping the swift AST for each file is slow, but if we can do many in parallel,
			// the overall performance isn't that bad. We *MAY* need to do mapLimit to
			// cap how many we do in parallel
			const startExtractSwift = Date.now();
			async.map(swiftFiles, (file, next) => {
				extractSwiftClasses(name, file, metabase, sdkPath, iosMinVersion, xcodeTargetOS, next);
			}, (err, results) => {
				util.logger.trace(`Took ${Date.now() - startExtractSwift}ms to extract swift classes`);
				if (err) {
					return callback(err);
				}

				// Now merge all the results together
				let generated = {
					classes: {},
					imports: Array.from(imports)
				};
				results.forEach(classes => {
					generated = metabaselib.merge(generated, { classes: classes });
				});

				// Add metadata to the metabase!
				generated.metadata = {
					'api-version': '1',
					dependencies: [], // TODO: inject the imports?
					'min-version': iosMinVersion,
					platform: 'ios',
					'system-generated': 'true',
					generated: new Date().toISOString(),
					'sdk-path': sdkPath
				};

				callback(null, generated);
			});
		});
	});
}

exports.generateSwiftFrameworkMetabase = generateSwiftFrameworkMetabase;
exports.generateSwiftMangledClassName = generateSwiftMangledClassName; // only exported for testing!

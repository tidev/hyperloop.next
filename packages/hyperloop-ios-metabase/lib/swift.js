/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015-2018 by Appcelerator, Inc.
 */
'use strict';

const fs = require('fs');
const spawn = require('child_process').spawn; // eslint-disable-line security/detect-child-process
const exec = require('child_process').exec; // eslint-disable-line security/detect-child-process

const util = require('./util');
const metabaselib = require('./metabase');
const Frameworks = require('./frameworks').Frameworks;
const ModuleMetadata = require('./module_metadata').ModuleMetadata;

// regular expressions for dealing with Swift ASTs
const COMPONENT_RE = /component id='(.*)'/;
const PATTERN_NAMED_RE = /pattern_named type='(\w+)' '(\w+)'/;
// example:  (parameter "width" apiName=width type='CGFloat' interface type='CGFloat')
// (parameter "self" type='MyUI.Type' interface type=\'MyUI.Type\'))
const PARAMETER_RE = /parameter "(\w+)"( apiName=\w+)?( type='([A-Za-z_]\w*(\.[A-Za-z_]\w*)*)')?( interface type='(\w+)')?( mutable)?( inout)?( shared)?( variadic)?/;
const TYPE_RE = /type='(\w+)'/;
const PUBLIC_ACCESS_PATTERN = /access=(public|open)/;

/**
 * Determine version of swift async
 * @return  {Promise<string>} returns version of swift
 */
function getVersion() {
	return new Promise((resolve, reject) => {
		exec('/usr/bin/xcrun swift -version', function (err, stdout) {
			if (err) {
				return reject(err);
			}
			const versionMatch = stdout.match(/version\s(\d.\d)/);
			if (versionMatch !== null) {
				return resolve(versionMatch[1]);
			}
			reject(new Error('Version string didn\'t match expectations: ' + stdout));
		});
	});
}

/**
 * generate Swift AST output from a swift file
 * @param {SDKEnvironment} sdk sdk info object
 * @param {String} sdk.sdkPath absolute path to the iOS SDK directory
 * @param {String} sdk.minVersion i.e. '9.0'
 * @param {String} sdk.sdkType 'iphoneos' || 'iphonesimulator'
 * @param {String} fn filename
 * @return {Promise<string>}
 */
function generateSwiftAST(sdk, fn) {
	const args = [ 'swiftc', '-sdk', sdk.sdkPath, '-dump-ast', fn ];
	if (sdk.sdkType === 'iphoneos' || sdk.sdkType === 'iphonesimulator') {
		args.push('-target');
		if (sdk.sdkType === 'iphoneos') {
			// armv7 for all devices. Note that we also could use armv7s or arm64 here
			args.push(`armv7-apple-ios${sdk.minVersion}`);
		} else {
			const simArch = process.arch === 'i386' ? 'i386' : 'x86_64';
			args.push(`${simArch}-apple-ios${sdk.minVersion}`);
		}
	}

	return new Promise((resolve, reject) => {
		const start = Date.now();
		const child = spawn('xcrun', args);
		let buf = '';
		// swiftc -sdk /Applications/Xcode.app/Contents/Developer/Platforms/iPhoneSimulator.platform/Developer/SDKs/iPhoneSimulator9.0.sdk -dump-ast MySwift.swift
		child.on('error', err => reject(err));
		child.stderr.on('data', function (data) {
			buf += data.toString();
		});
		child.on('exit', function (ec) {
			if (ec === 1) {
				return reject(new Error(`Swift file at ${fn} has compiler problems. Please check to make sure it compiles OK.`));
			}
			util.logger.trace(`Took ${Date.now() - start}ms to generate swift AST for ${fn}`);
			resolve(buf);
		});
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
	throw new Error(`Swift Generation failed with unknown or unsupported type (${value}) found while compiling ${filename}`);
}

/**
 * extract all the imports found in the buffer
 * @param {String} buf buffer to match against
 * @returns {String[]}
 */
function extractImports(buf) {
	// FIXME This doesn't handle specifying the type of the import. May not support UIKit.UITableViewController style either?
	// See https://robots.thoughtbot.com/swift-imports
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
 * For trying to decode AST syntax: https://github.com/apple/swift/blob/master/lib/AST/ASTDumper.cpp
 * @param  {String}   framework     name of the framework to assign this file to
 * @param  {string} fn            filename of the swift source
 * @param  {Object}   metabase      Metabase of dependencies to look up types
 * @param  {SDKEnvironment} sdk sdk info object
 * @param {String} sdk.sdkPath absolue filepath to ios SDK directory
 * @param {String} sdk.minVersion i.e. '9.0'
 * @param {String} sdk.sdkType 'iphoneos' || 'iphonesimulator'
 * @returns  {Promise<object>}
 */
function extractSwiftClasses(framework, fn, metabase, sdk) {
	return generateSwiftAST(sdk, fn)
		.then(buf => {
			const lines = buf.split(/\n/);

			const classes = {};
			let classdef,
				methodef,
				vardef;

			// FIXME This code is nasty and likely pretty slow.
			// We should rewrite this!
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

			return Promise.resolve(classes);
		});
}

/**
 * Wraps user swift sources into grouped frameworks (mapped by name to "metadata")
 * @param  {object[]} swiftSources array of objects each having a 'framework' and 'source' key
 * @return {Promise<Map<string, ModuleMetadata>>}
 */
function generateSwiftFrameworks(swiftSources) {
	return new SwiftFrameworks(swiftSources).load();
}

class SwiftModule extends ModuleMetadata {
	constructor(name, files) {
		super(name, files[0], ModuleMetadata.MODULE_TYPE_DYNAMIC);
		this.files = files;
	}

	/**
	 * Returns the metabase JSON object. May be from in-memory cache, on-disk cache, or generated on-demand.
	 * @param  {SDKEnvironment} sdk The SDk information used to generate the metabase
	 * @return {Promise<object>}
	 */
	generateMetabase(sdk) {
		// If we have the cached in-memory copy of the metabase, return it!
		if (this._metabase) {
			return Promise.resolve(this._metabase);
		}

		let imports;
		return this.getDependencies(sdk)
			.then(importSet => {
				imports = Array.from(importSet);
				// FIXME Pass in all the other frameworks here? Otherwise we're limited as to what the swift source can reference!
				// For now, let's just cheat and use the system frameworks
				return sdk.getSystemFrameworks();
			})
			.then(frameworks => {
				// Ok, so we know what the set of swift files imported, now let's generate a
				// deep, unified metabase from the frameworks used plus all dependencies
				return metabaselib.unifiedMetabase(sdk, frameworks, imports);
			})
			.then(metabase => {
				// Generate the classes in parallel, then merge them sync at the end!
				// dumping the swift AST for each file is slow, but if we can do many in parallel,
				// the overall performance isn't that bad.
				const extractPromises = this.files.map(file => {
					return extractSwiftClasses(this.name, file, metabase, sdk);
				});
				return Promise.all(extractPromises);
			})
			.then(results => {
				// results is an array of objects
				// Now merge all the results together
				let generated = {
					classes: {},
					imports: imports
				};
				results.forEach(classes => {
					generated = metabaselib.merge(generated, { classes: classes });
				});

				// Add metadata to the metabase!
				generated.metadata = {
					'api-version': '1',
					dependencies: [], // TODO: inject the imports?
					'min-version': sdk.minVersion,
					platform: 'ios',
					'system-generated': 'true',
					generated: new Date().toISOString(),
					'sdk-path': sdk.sdkPath
				};
				this._metabase = generated;
				return Promise.resolve(generated);
			});
	}

	/**
	 * Returns the shallow set of all dependencies (the names of the frameworks)
	 * @param  {SDKEnvironment} sdk The SDk information used to generate the metabase
	 * @return {Promise<Set<string>>}
	 */
	getDependencies(sdk) { // eslint-disable-line no-unused-vars
		// extract imports for each swift file in paralle
		const promises = this.files.map(f => {
			return new Promise(resolve => {
				resolve(extractImports(fs.readFileSync(f).toString()));
			});
		});
		return Promise.all(promises)
			.then(results => {
				// results should be an array of arrays
				// Smush down to a Set of unique imports
				const imports = new Set();
				results.forEach(r => {
					r.forEach(i => imports.add(i));
				});
				if (imports.size === 0) {
					// Assume 'Foundation' is always included
					imports.add('Foundation');
				}
				return Promise.resolve(imports);
			});
	}
}

class SwiftFrameworks extends Frameworks {
	constructor(swiftSources) {
		super();
		this.swiftSources = swiftSources;
	}

	/**
	 * Overridden to avoid on-disk cache mechanism.
	 * @return {Promise<Map<string, ModuleMetadata>>}
	 */
	load() {
		// do we have it in memory?
		if (this.modules) {
			return Promise.resolve(this.modules);
		}
		// Not in-memory. Do the real work.
		return this.detect().then(modules => {
			// then store in memory
			this.modules = modules;
			return Promise.resolve(modules);
		});
	}

	/**
	 * Turns a grouping of names to swift files into a map of frameworks that wraps this data
	 * @return {Promise<Map<string, ModuleMetadata>>}
	 */
	detect() {
		const swiftFrameworks = new Map();
		this.swiftSources.forEach(entry => {
			let files = [];
			if (swiftFrameworks.has(entry.framework)) {
				files = swiftFrameworks.get(entry.framework);
			}
			files.push(entry.source);
			swiftFrameworks.set(entry.framework, files);
		});
		const modules = new Map();
		swiftFrameworks.forEach((files, name) => {
			modules.set(name, new SwiftModule(name, files));
		});
		return Promise.resolve(modules);
	}
}

exports.generateSwiftMangledClassName = generateSwiftMangledClassName; // only exported for testing!
exports.getVersion = getVersion;
exports.generateSwiftFrameworks = generateSwiftFrameworks;

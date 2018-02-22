/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015-2018 by Appcelerator, Inc.
 */
'use strict';

const fs = require('fs'),
	utillib = require('./util'),
	async = require('async'),
	metabaselib = require('./metabase'),
	spawn = require('child_process').spawn; // eslint-disable-line security/detect-child-process

/**
 * generate Swift AST output from a swift file
 * @param {String} sdkPath absolute path to the iOS SDK directory
 * @param {String} iosMinVersion i.e. '9.0'
 * @param {String} xcodeTargetOS 'iphoneos' || 'iphonesimulator'
 * @param {String} fn filename
 * @param {Function} callback callback function
 */
function generateSwiftAST(sdkPath, iosMinVersion, xcodeTargetOS, fn, callback) {
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
	if (utillib.isPrimitive(value.toLowerCase())) {
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

function uniq(a) {
	const copy = [];
	for (var c = 0; c < a.length; c++) {
		const e = a[c];
		if (copy.indexOf(e) < 0) {
			copy.push(e);
		}
	}
	return copy;
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
 * return a merged metabase
 * @param {String} buildDir output directory
 * @param {String} sdk 'iphoneos' || 'iphonesimulator'
 * @param {String} sdkPath absolute path to SDK directory
 * @param {String} iosMinVersion i.e. '9.0'
 * @param {Array} imports I don't know
 * @param {Object} metabase generated metabase
 * @param {Function} callback callback function
 * @returns {void}
 */
function generateAndMerge(buildDir, sdk, sdkPath, iosMinVersion, imports, metabase, callback) {
	if (imports.length === 0) {
		return callback(null, metabase);
	}
	if (metabase.$includes) {
		// if we have all the imports already in our metabase, just return instead of merging
		const need = [];
		for (let c = 0; c < imports.length; c++) {
			if (metabase.$includes.indexOf(imports[c]) < 0) {
				need.push(imports[c]);
			}
		}
		if (need.length === 0) {
			return callback(null, metabase);
		}
		// only generate any missing imports to speed up the merge
		imports = need;
	}
	metabaselib.generateMetabase(buildDir, sdk, sdkPath, iosMinVersion, imports, false, function (err, json) {
		if (err) {
			return callback(err);
		}
		const includes = metabase.$includes ? uniq(metabase.$includes.concat(imports)) : imports;
		metabase = metabaselib.merge(metabase, json);
		metabase.$includes = includes;
		return callback(null, metabase);
	});
}

/**
 * parse a swift file into a metabase type JSON result
 * @param {String} buildDir output directory
 * @param {String} sdk 'iphoneos' || 'iphonesimulator'
 * @param {String} sdkPath absolue filepath to ios SDK directory
 * @param {String} iosMinVersion i.e. '9.0'
 * @param {String} xcodeTargetOS 'iphoneos' || 'iphonesimulator'
 * @param {Object} metabase generated metabase
 * @param {String} framework name of the framework
 * @param {String} fn file name
 * @param {Function} callback callback function
 * @deprecated Use generateSwiftFrameworkMetabase
 */
function generateSwiftMetabase(buildDir, sdk, sdkPath, iosMinVersion, xcodeTargetOS, metabase, framework, fn, callback) {
	generateSwiftAST(sdkPath, iosMinVersion, xcodeTargetOS, fn, function (err, buf) {
		if (err) {
			return callback(err, buf);
		}

		// read our imports from the file so we can generate an appropriate metabase
		const imports = extractImports(fs.readFileSync(fn).toString());
		// turn our imports into includes for the metabase generation
		const includes = imports.map(function (name) {
			return '<' + name + '/' + name + '.h>';
		});
		const lines = buf.split(/\n/);

		// we need to merge our metabase with any imports found in our swift file in case there are imports found in
		// swift that we haven't imported in the incoming metabase
		generateAndMerge(buildDir, sdk, sdkPath, iosMinVersion, includes, metabase, function (err, metabase) {
			if (err) {
				return callback(err);
			}
			const componentRE = /component id='(.*)'/;
			const patternNamedRE = /pattern_named type='(\w+)' '(\w+)'/;
			const typeRE = /type='(\w+)'/;
			const publicAccessPattern = /access=(public|open)/;

			const classes = {};
			let classdef,
				methodef,
				vardef;

			lines.forEach(function (line, index) {
				line = line.toString().trim();
				if (line) {
					// console.log('line=>', line.substring(0, 5));
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
							if (publicAccessPattern.test(t)) {
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
							if (publicAccessPattern.test(t)) {
								vardef.public = true;
							} else if (t.indexOf('type=') === 0) {
								vardef.type = resolveType(fn, metabase, typeRE.exec(t)[1]);
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
						tok.splice(2).forEach(function (t) {
							if (publicAccessPattern.test(t)) {
								methodef.public = true;
							} else if (t.indexOf('type=') === 0) {
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
					} else if (methodef && line.indexOf('(pattern_named ') === 0 && patternNamedRE.test(line)) {
						const re = patternNamedRE.exec(line);
						const t = resolveType(fn, metabase, re[1]);
						methodef.arguments.push({
							name: re[2],
							type: t
						});
					} else if (methodef && line.indexOf('(result') === 0 && lines[index + 1].trim().indexOf('(type_ident') === 0 && lines[index + 2].trim().indexOf('(component ') === 0) {
						methodef.returns = resolveType(fn, metabase, componentRE.exec(lines[index + 2].trim())[1]);
						methodef = null;
					}
				}
			});

			callback(null, {
				imports: imports,
				classes: classes,
				filename: fn
			}, metabase);

		});

	});
}

/**
 * Parses a single swift source file and extract the classes defined within.
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
		const componentRE = /component id='(.*)'/;
		const patternNamedRE = /pattern_named type='(\w+)' '(\w+)'/;
		const typeRE = /type='(\w+)'/;
		const publicAccessPattern = /access=(public|open)/;

		const classes = {};
		let classdef,
			methodef,
			vardef;

		lines.forEach(function (line, index) {
			line = line.toString().trim();
			if (line) {
				// console.log('line=>', line.substring(0, 5));
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
						if (publicAccessPattern.test(t)) {
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
						if (publicAccessPattern.test(t)) {
							vardef.public = true;
						} else if (t.indexOf('type=') === 0) {
							vardef.type = resolveType(fn, metabase, typeRE.exec(t)[1]);
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
					tok.splice(2).forEach(function (t) {
						if (publicAccessPattern.test(t)) {
							methodef.public = true;
						} else if (t.indexOf('type=') === 0) {
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
				} else if (methodef && line.indexOf('(pattern_named ') === 0 && patternNamedRE.test(line)) {
					const re = patternNamedRE.exec(line);
					const t = resolveType(fn, metabase, re[1]);
					methodef.arguments.push({
						name: re[2],
						type: t
					});
				} else if (methodef && line.indexOf('(result') === 0 && lines[index + 1].trim().indexOf('(type_ident') === 0 && lines[index + 2].trim().indexOf('(component ') === 0) {
					methodef.returns = resolveType(fn, metabase, componentRE.exec(lines[index + 2].trim())[1]);
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

			let generated = { classes: {} };
			// TODO: Generate the classes in parallel, then merge them sync at the end!
			async.eachSeries(swiftFiles, (file, next) => {
				extractSwiftClasses(name, file, metabase, sdkPath, iosMinVersion, xcodeTargetOS, (err, classes) => {
					if (err) {
						return next(err);
					}
					// merge the classes into a single metabase!
					generated = metabaselib.merge(generated, { classes: classes });
					next();
				});
			}, err => {
				if (err) {
					return callback(err);
				}

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
exports.generateSwiftMetabase = generateSwiftMetabase;
exports.generateSwiftMangledClassName = generateSwiftMangledClassName;

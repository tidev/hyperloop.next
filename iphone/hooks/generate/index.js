/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015-2018 by Appcelerator, Inc.
 */
'use strict';
const fs = require('fs-extra');
const path = require('path');
const async = require('async');
const genclass = require('./class');
const genmodule = require('./module');
const genstruct = require('./struct');
const genenum = require('./enum');
const genblock = require('./block');
const gencustom = require('./custom');
const CodeGenerator = require('./code-generator');
const util = require('./util');

function makeModule(modules, e, state) {
	// TODO: I don't think we need state here!
	if (e.framework) {
		if (!(e.framework in modules)) {
			modules[e.framework] = {
				name: e.framework,
				framework: e.framework,
				filename: e.filename,
				functions: [],
				variables: [],
				static_variables: {},
				blocks: [],
				frameworks: {},
				state: state,
				customSource: e.customSource || false
			};
		}
		return modules[e.framework];
	}
}

function merge(src, dest) {
	if (src) {
		dest =  dest || {};
		for (var k in src) {
			if (!(k in dest)) {
				dest[k] = src[k];
			}
		}
	}
}

/**
 * Checks if a parent class in the inheritance path already implemented
 * the given protocol.
 *
 * @param {Object} json Native code metabase
 * @param {Object} cls Class to traverse upwards from
 * @param {String} proto The protocol to look for in parent classes
 * @return {bool} True if protocol already implemented in a parent class, false otherwise.
 */
function isProtocolImplementedBySuperClass(json, cls, proto) {
	let parentClass = cls && cls.superclass;
	while (parentClass) {
		if (parentClass.protocols && parentClass.protocols.indexOf(proto) !== -1) {
			return true;
		}
		parentClass = parentClass.superclass ? json.classes[parentClass.superclass] : null;
	}

	return false;
}

/**
 * Iterates over all given protocols and processes protocol inheritance by
 * incorporating one protocol into another through merging their methods and
 * properties.
 *
 * @param {Object} protocols Object with protocols from the metabase
 */
function processProtocolInheritance(protocols) {
	var mergedProtocols = [];
	/**
	 * Recursively merges a protocol with all it's inherited protocols
	 *
	 * @param {Object} protocol A protocol
	 * @param {Number} logIntendationLevel Intendation level for debugging messages
	 */
	function mergeWithParentProtocols(protocol, logIntendationLevel) {
		const logIntendationCharacter = '  ';
		let logIntendation = logIntendationCharacter.repeat(logIntendationLevel++);
		const parentProtocols = protocol.protocols;
		const protocolSignature = parentProtocols ? protocol.name + ' <' + parentProtocols.join(', ') + '>' : protocol.name;
		util.logger.trace(logIntendation + 'Processing inherited protocols of ' + protocolSignature);
		logIntendation = logIntendationCharacter.repeat(logIntendationLevel);

		if (mergedProtocols.indexOf(protocol.name) !== -1) {
			util.logger.trace(logIntendation + protocol.name + ' was already merged with all protocols it inherits from.');
			return;
		}
		if (!parentProtocols) {
			util.logger.trace(logIntendation + protocol.name + ' does not inherit from any other protocols.');
			mergedProtocols.push(protocol.name);
			return;
		}

		util.logger.trace(logIntendation + 'Iterating over inherited protocols of ' + protocol.name);
		logIntendationLevel++;
		protocol.protocols.forEach(function (parentProtocolName) {
			if (protocol.name === parentProtocolName) {
				util.logger.trace(logIntendation + 'Invalid protocol meta information. ' + protocol.name.red + ' cannot have itself as parent, skipping.');
				return;
			}
			const parentProtocol = protocols[parentProtocolName];
			if (!parentProtocol) {
				console.log('Failed to find protocol by name: ' + parentProtocolName + '. Parent of ' + JSON.stringify(protocol));
			}
			mergeWithParentProtocols(parentProtocol, logIntendationLevel);

			util.logger.trace(logIntendation + 'Merging ' + parentProtocol.name.cyan + ' => ' + protocol.name.cyan);
			protocol.properties = protocol.properties || {};
			protocol.methods = protocol.methods || {};
			merge(parentProtocol.properties, protocol.properties);
			merge(parentProtocol.methods, protocol.methods);
		});

		mergedProtocols.push(protocol.name);
	}

	Object.keys(protocols).forEach(function (protocolName) {
		var protocol = protocols[protocolName];
		if (!protocol) {
			console.log('Failed to find protoocl by name: ' + protocolName);
		}
		var logIntendationLevel = 0;
		mergeWithParentProtocols(protocol, logIntendationLevel);
	});
}

/**
 * Modifies an existing metabase JSON object with builtins
 * @param  {Object}   json metabase JSON object
 * @param  {Function} callback Typical async callback function
 * @return {void}
 */
function generateBuiltins(json, callback) {
	const dir = path.join(__dirname, 'templates', 'builtins');
	fs.readdir(dir, function (err, files) {
		if (err) {
			return callback(err);
		}
		async.eachSeries(files, function (fn, cb) {
			const gen = require(path.join(dir, fn)); // eslint-disable-line security/detect-non-literal-require
			gen(json, cb);
		}, callback);
	});
}

/**
 * Generates JS stubs from a metabase (json)
 * @param  {String}   name     [description]
 * @param  {Object}   json     The metabase used to generate the JS stubs
 * @param  {gencustom.ParserState}   state    [description]
 * @param  {Function} callback [description]
 * @param  {Map<string, ModuleMetadata>}   includes [description]
 * @return {void}
 */
function generateFromJSON(name, json, state, callback, includes) {
	// set the name of the app in the state object
	state.appName = name;

	if (!json) {
		return callback();
	}

	json.classes = json.classes || {};

	generateBuiltins(json, function (err) {
		if (err) {
			return callback(err);
		}

		// FIXME: Is this hack necessary? Shouldn't this go into the metabase generation for Foundation framework?
		if (!json.classes.NSObject) {
			json.classes.NSObject = {
				methods: {},
				properties: {},
				framework: 'Foundation',
				name: 'NSObject'
			};
		}
		if (!json.protocols.NSObject) {
			json.protocols.NSObject = {
				methods: {},
				properties: {},
				framework: 'Foundation',
				name: 'NSObject'
			};
		}

		// attach these base methods to NSObject
		[ 'stringValue', 'boolValue', 'intValue', 'charValue', 'floatValue', 'shortValue',
			'longValue', 'longLongValue', 'unsignedIntValue', 'unsignedCharValue',
			'unsignedShortValue', 'unsignedLongLongValue',
			'unsignedLongValue', 'isNull', 'protect', 'unprotect' ].forEach(function (t) {
			json.classes.NSObject.methods[t] = {
				instance: true,
				name: t,
				arguments: [],
				selector: t,
				returns: {
					encoding: '@',
					value: 'id',
					type: 'id'
				},
				impl: function () {
					return 'var result = Hyperloop.' + t + '(this.$native);';
				}
			};
		});

		json.classes.NSObject.methods.extend = {
			instance: false,
			name: 'extend',
			impl: function () {
				return 'Hyperloop.extend(this.$class, arguments[0], arguments[1]);';
			}
		};

		// remove these functions for now until we can fix them
		[ 'NSLogv', 'NSLog', 'UIApplicationMain' ].forEach(function (fn) {
			if (json.functions) {
				delete json.functions[fn];
			}
		});

		// we must have a root object even those this is a protocol and
		// handled special in objective-c
		json.classes.NSObject.framework = 'Foundation';
		json.protocols.NSObject.framework = 'Foundation';

		// create an inverse map of custom classfiles to framework
		const custom_frameworks = {};
		if (includes) {
			const frameworks = Object.keys(includes);
			for (let i = 0; i < frameworks.length; i++) {
				const name = frameworks[i];
				const classes = Object.keys(includes[name]);
				for (let c = 0; c < classes.length; c++) {
					const clsfile = includes[name][classes[c]];
					custom_frameworks[clsfile] = name;
				}
			}
		}

		processProtocolInheritance(json.protocols);

		const sourceSet = {
			classes: {},
			structs: {},
			enums: {},
			modules: {},
			customs: {}
		};

		// classes
		Object.keys(json.classes).forEach(function (k) {
			var cls = json.classes[k];
			if (cls.filename === '/usr/include/objc/NSObject.h') {
				cls.framework = 'Foundation';
			}
			// add protocols
			if (cls.protocols && cls.protocols.length) {
				cls.protocols.forEach(function (p) {
					if (isProtocolImplementedBySuperClass(json, cls, p)) {
						return;
					}
					const protocol = json.protocols[p];
					if (protocol) {
						cls.properties = cls.properties || {};
						cls.methods = cls.methods || {};
						merge(protocol.properties, cls.properties);
						merge(protocol.methods, cls.methods);
					}
				});
			}
			sourceSet.classes[k] = genclass.generate(json, cls, state);
		});

		// structs
		json.structs && Object.keys(json.structs).forEach(function (k) {
			const struct = json.structs[k];
			if (/^_+/.test(k)) {
				// if we have leading underscores for struct names, trim them
				struct.name = struct.name.replace(/^(_)+/g, '').trim();
			}
			sourceSet.structs[k] = genstruct.generate(json, struct);
		});

		// enums
		json.enums && Object.keys(json.enums).forEach(function (k) {
			const enumobj = json.enums[k];
			sourceSet.enums[k] = genenum.generate(json, k, enumobj);
		});

		// modules
		const modules = {};
		// define module based functions
		json.functions && Object.keys(json.functions).forEach(function (k) {
			const func = json.functions[k];
			const mod = makeModule(modules, func, state);
			mod && mod.functions.push(func);
		});
		// define module based constant variables
		json.vars && Object.keys(json.vars).forEach(function (k) {
			const varobj = json.vars[k];
			const mod = makeModule(modules, varobj, state);
			mod && mod.variables.push(varobj);
		});
		// define module based enums
		json.enums && Object.keys(json.enums).forEach(function (k) {
			var enumobj = json.enums[k];
			var mod = makeModule(modules, enumobj, state);
			if (mod && enumobj.values) {
				Object.keys(enumobj.values).forEach(function (n) {
					mod.static_variables[n] =  enumobj.values[n];
				});
			}
		});
		// define blocks
		json.blocks && Object.keys(json.blocks).forEach(function (k) {
			const blocks = json.blocks[k];
			let frameworkName = k;
			if (frameworkName[0] === '/') {
				frameworkName = custom_frameworks[k] || k;
			}
			const mod = makeModule(modules, { framework: frameworkName, filename: '' }, state);
			mod && blocks.forEach(function (block) {
				block && mod.blocks.push(genblock.generateBlockWrapper(mod, json, block));
			});
		});

		// generate the modules
		modules && Object.keys(modules).forEach(function (k) {
			const moduleInfo = genmodule.generate(json, modules[k], state);
			if (moduleInfo) {
				sourceSet.modules[k] = moduleInfo;
			}
		});

		// generate any custom classes
		sourceSet.customs = gencustom.generate(state, json);

		callback(null, sourceSet, modules);
	});
}

/**
 * parse from a buffer
 * @param {string|Buffer} buf source code
 * @param {string} fn filename
 * @param {gencustom.ParserState} state parser state
 * @returns {gencustom.ParserState}
 */
function parseBuffer(buf, fn, state) {
	const parser = new gencustom();
	return parser.parse(buf, fn, state);
}

exports.generateFromJSON = generateFromJSON;
exports.parseFromBuffer = parseBuffer;
exports.CodeGenerator = CodeGenerator;
exports.generateBuiltins = generateBuiltins;

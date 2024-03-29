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
const genblock = require('./block');
const gencustom = require('./custom');
const CodeGenerator = require('./code-generator');
const util = require('./util');

function makeModule(modules, e, state) {
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
	var parentClass = cls && cls.superclass;
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
		var logIntendationCharacter = '  ';
		var logIntendation = logIntendationCharacter.repeat(logIntendationLevel++);
		var parentProtocols = protocol.protocols;
		var protocolSignature = parentProtocols ? protocol.name + ' <' + parentProtocols.join(', ') + '>' : protocol.name;
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
			var parentProtocol = protocols[parentProtocolName];
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
		var logIntendationLevel = 0;
		mergeWithParentProtocols(protocol, logIntendationLevel);
	});
}

function generateBuiltins(json, callback) {
	var dir = path.join(__dirname, 'templates', 'builtins');
	fs.readdir(dir, function (err, files) {
		if (err) { return callback(err); }
		async.eachSeries(files, function (fn, cb) {
			var gen = require(path.join(dir, fn));
			gen(json, cb);
		}, callback);
	});
}

function generateFromJSON(name, json, state, callback, includes) {
	// set the name of the app in the state object
	state.appName = name;

	if (!json) { return callback(); }

	json.classes = json.classes || {};

	generateBuiltins(json, function (err) {
		if (err) { return callback(err); }

		if (!json.classes.NSObject) {
			json.classes.NSObject = {
				methods:{},
				properties:{},
				framework:'Foundation',
				name: 'NSObject'
			};
		}

		// attach these base methods to NSObject
		['stringValue','boolValue','intValue','charValue','floatValue','shortValue',
		'longValue','longLongValue','unsignedIntValue','unsignedCharValue',
		'unsignedShortValue','unsignedLongLongValue',
		'unsignedLongValue','isNull', 'protect', 'unprotect'].forEach(function(t) {
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
		['NSLogv', 'NSLog', 'UIApplicationMain'].forEach(function (fn) {
			if (json.functions) {
				delete json.functions[fn];
			}
		});

		// we must have a root object even those this is a protocol and
		// handled special in objective-c
		json.classes.NSObject.framework = 'Foundation';

		// create an inverse map of custom classfiles to framework
		var custom_frameworks = {};
		if (includes) {
			var frameworks = Object.keys(includes);
			for (var i = 0; i < frameworks.length; i++) {
				var name = frameworks[i];
				var classes = Object.keys(includes[name]);
				for (var c = 0; c < classes.length; c++) {
					var clsfile = includes[name][classes[c]];
					custom_frameworks[clsfile] = name;
				}
			}
		}

		processProtocolInheritance(json.protocols);

		var modules = {};
		var sourceSet = {
			classes: {},
			structs: {},
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
					var protocol = json.protocols[p];
					if (protocol) {
						cls.properties = cls.properties || {};
						cls.methods = cls.methods || {};
						merge(protocol.properties, cls.properties);
						merge(protocol.methods, cls.methods);
					}
				});
			}
			sourceSet.classes[k] = genclass.generate(json, cls, state);
			makeModule(modules, cls, state);
		});

		// structs
		json.structs && Object.keys(json.structs).forEach(function (k) {
			var struct = json.structs[k];
			if (/^_+/.test(k)) {
				// if we have leading underscores for struct names, trim them
				struct.name = struct.name.replace(/^(_)+/g,'').trim();
			}
			sourceSet.structs[k] = genstruct.generate(json, struct);
		});

		// define module based functions
		json.functions && Object.keys(json.functions).forEach(function (k) {
			var func = json.functions[k];
			var mod = makeModule(modules, func, state);
			mod && mod.functions.push(func);
		});
		// define module based constant variables
		json.vars && Object.keys(json.vars).forEach(function (k) {
			var varobj = json.vars[k];
			var mod = makeModule(modules, varobj, state);
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
			var blocks = json.blocks[k];
			var frameworkName = k;
			if (frameworkName[0] === '/') {
				frameworkName = custom_frameworks[k] || k;
			}
			var mod = makeModule(modules, {framework: frameworkName, filename: ''}, state);
			mod && blocks.forEach(function (block) {
				block && mod.blocks.push(genblock.generateBlockWrapper(mod, json, block));
			});
		});

		// generate the modules
		modules && Object.keys(modules).forEach(function (k) {
			var moduleInfo = genmodule.generate(json, modules[k], state);
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
 */
function parseBuffer(buf, fn, state) {
	var parser = new gencustom();
	return parser.parse(buf, fn, state);
}

exports.generateFromJSON = generateFromJSON;
exports.parseFromBuffer = parseBuffer;
exports.CodeGenerator = CodeGenerator;

/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015 by Appcelerator, Inc.
 */
var util = require('./util'),
	path = require('path'),
	fs = require('fs');

function makeModule (json, module, state) {
	var entry = {
		class: {
			name: module.name,
			properties: [],
			class_methods: [],
			obj_class_method: [],
			static_variables: {},
			blocks: module.blocks
		},
		framework: module.framework,
		filename: module.filename,
		imports: {},
		renderedImports: '',
		frameworks: module.frameworks || {}
	};
	// filter static variables
	module.static_variables && Object.keys(module.static_variables).forEach(function (name) {
		if (state.isSetterPropertyReferenced(name) || state.isGetterPropertyReferenced(name)) {
			var v = module.static_variables[name];
			entry.class.static_variables[name] = v;
		}
	});
	// functions
	module.functions.forEach(function (fn) {
		if (/^__/.test(fn.name)) {
			return;
		}
		if (state.isFunctionReferenced(fn.name)) {
			entry.class.class_methods.push(util.generateFunction(entry, json, fn));
			var code = util.generateObjCFunction(entry, json, fn);
			if (entry.class.obj_class_method.indexOf(code) < 0) {
				entry.class.obj_class_method.push(code);
			}
		}
	});
	// constant variables
	module.variables.forEach(function (v) {
		var name = v.name;
		if (state.isSetterPropertyReferenced(name) || state.isGetterPropertyReferenced(name)) {
			entry.class.properties.push(util.generateProp(entry, json, v, true, '$class'));
			var fn = {
				name: name,
				arguments: [],
				returns: v
			};
			var code = util.generateObjCFunction(entry, json, fn, true);
			entry.class.obj_class_method.push(code);
		}
	});

	entry.renderedImports = util.makeImports(json, entry.imports);
	return entry;
}

/**
 * Generates the source template data for a module file and it's module
 * objective-c class
 */
function generate (json, mod, state) {
	// for now, skip non frameworks
	if (mod.framework.indexOf('/') >= 0 || mod.customSource) { return; }
	// generate the objective-c module
	var m = makeModule(json, mod, state);
	var found = json.classes[mod.name];
	m.excludeHeader = !!found;
	if (m.class.properties.length ||
		m.class.class_methods.length ||
		m.class.obj_class_method.length ||
		Object.keys(m.class.static_variables).length ||
		m.class.blocks.length) {
		if (mod.filename.match(/-Swift\.h$/)) {
			m.import = mod.framework + '/' + path.basename(mod.filename);
			if (m.frameworks[mod.framework]) {
				delete m.frameworks[mod.framework];
			}
		} else {
			m.frameworks[mod.framework] = 1;
		}
	}

	return m;
}

exports.generate = generate;

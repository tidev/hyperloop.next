/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015-2018 by Appcelerator, Inc.
 */
'use strict';
const util = require('./util');
const imports = require('./imports');
const method = require('./method');

function generateFunction(state, json, fn) {
	fn.selector = fn.name + ':';
	var code = [],
		preamble = [];

	code.push('Object.defineProperty(' + state.class.name + ', \'' + fn.name + '\', {');
	code.push('\tvalue: function ' + util.generateArgList(state, json, fn.arguments, '(', ')', '()') + ' {');
	code.push('\t\tif (!$init) { $initialize(); }');

	var body = method.generateMethodBody(state, json, fn, preamble, false, '$class', function (arg) {
		return '[' + arg + ']';
	});
	preamble.length && (code.push('\t\t' + preamble.join('\n\t\t')));

	code.push(body);
	code.push('\t\t\treturn result;');
	code.push('\t},');
	code.push('\tenumerable: false,');  // don't show in enumeration
	code.push('\twritable: true');  // allow to be changed
	code.push('});');

	return code.join('\n');
}

function makeModule(json, module, state) {
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
			entry.class.class_methods.push(generateFunction(entry, json, fn));
			var code = generateObjCFunction(entry, json, fn);
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
			var code = generateObjCFunction(entry, json, fn, true);
			entry.class.obj_class_method.push(code);
		}
	});

	entry.renderedImports = imports.makeImports(json, entry.imports);
	return entry;
}

function generateObjCArgument(state, json, fn, arg, i, arglist, tab, define) {
	const code = [];
	const name = arg.name || 'arg' + i;
	tab = tab || '';
	define = define === undefined ? true : define;
	code.push('\tid ' + name + '_ = [args objectAtIndex:' + i + '];');
	code.push(util.generateObjCValue(state, json, fn, arg, name, define, tab, arglist));
	// state, json, arg, name, define, tab, arglist
	return tab + code.join('\n' + tab);
}

/**
 * [getObjCReturnType description]
 * @param  {object} value [description]
 * @param  {string} value.type [description]
 * @param {object} json metabase
 * @return {string}
 */
function getObjCReturnType(value, json) {
	switch (value.type) {
		case 'typedef': {
			const typedef = json.typedefs[value.value];
			if (!typedef) {
				throw new Error('Unable to find typedef in metabase: ' + value.value);
			}
			return getObjCReturnType(typedef, json);
		}
		case 'unknown':
		case 'enum':
		case 'pointer':
		case 'function_callback':
		case 'union':
		case 'unexposed':
		case 'vector':
		case 'block':
		case 'incomplete_array':
		case 'struct': {
			return value.value || 'void *';
		}
		case 'record': {
			if (!value.value) {
				return 'void *';
			}
			// How do we handle a case where the value is "struct CGAffineTransform"?
			if (value.value.indexOf('struct ') === 0) {
				const structName = value.value.substring(7).replace(/^_+/, '').trim();
				const struct = json.structs[structName];
				if (!struct) {
					throw new Error('Unable to find struct in metabase: ' + structName);
				}
				return structName;
			}
			break;
		}
		case 'id':
		case 'obj_interface':
		case 'objc_pointer': {
			return 'id';
		}
		case 'class':
		case 'Class': {
			return 'Class';
		}
		case 'selector':
		case 'SEL': {
			return 'SEL';
		}
	}
	if (util.isPrimitive(value.type)) {
		return value.value || util.getPrimitiveValue(value.type);
	}
	throw new Error('cannot figure out objc return type: ' + JSON.stringify(value));
}

function generateObjCResult(state, json, fn, arglist, asProperty, tab) {
	let returnCode = '';
	const code = [];
	tab = tab || '';
	if (fn.returns && fn.returns.type !== 'void') {
		const returnType = getObjCReturnType(fn.returns, json);
		returnCode =  returnType + ' result$ = (' + returnType + ')';
	}
	if (asProperty) {
		code.push('\t' + returnCode + fn.name + ';');
	} else {
		code.push('\t' + returnCode + fn.name + '(' + arglist.join(', ') + ');');
	}
	if (fn.returns && fn.returns.type !== 'void') {
		code.push('\t' + util.getObjCReturnResult(json, fn.returns, 'result$'));
	} else {
		code.push('\treturn nil;');
	}
	return tab + code.join('\n' + tab);
}

function generateObjCFunction(state, json, fn, asProperty) {
	// console.log(state.class.name + ' ' + fn.name);
	var code = [];
	if (asProperty) {
		code.push('+(id)' + fn.name + ' {');
	} else {
		code.push('+(id)' + fn.name + ':(NSArray *)args {');
	}
	var MAX_TIMES = 10;
	var arglist = [];
	var c;
	if (!asProperty) {
		if (!fn.variadic) {
			code.push('#ifdef TARGET_IPHONE_SIMULATOR');
			code.push('\tif ([args count] != ' + fn.arguments.length + ') {');
			code.push('\t\t@throw [NSException exceptionWithName:@"InvalidArgument" reason:[NSString stringWithFormat:@"' + fn.name + ' requires ' + fn.arguments.length + ' arguments but only %lu passed", (unsigned long)[args count]] userInfo:nil];');
			code.push('\t}');
			code.push('#endif');
		} else {
			code.push('#ifdef TARGET_IPHONE_SIMULATOR');
			code.push('\tif ([args count] < ' + (fn.arguments.length + 1) + ') {');
			code.push('\t\t@throw [NSException exceptionWithName:@"InvalidArgument" reason:[NSString stringWithFormat:@"' + fn.name + ' requires at least ' + (fn.arguments.length + 1) + ' arguments but only %lu passed", (unsigned long)[args count]] userInfo:nil];');
			code.push('\t}');
			code.push('#endif');
		}
		fn.arguments.forEach(function (arg, i) {
			code.push(generateObjCArgument(state, json, fn, arg, i, arglist));
		});
		if (fn.variadic) {
			for (c = fn.arguments.length; c < MAX_TIMES; c++) {
				// TODO: need to deal with the format specifiers like NSLog
				// TODO: handle functions that require sentinel
				var arg = {
					type: 'id',
					value: 'id',
					encoding: '@',
					name: 'arg' + c
				};
				code.push('\tid arg' + c + ' = nil;');
				code.push('\tif ([args count] > ' + c + ') {');
				code.push(generateObjCArgument(state, json, fn, arg, c, arglist, '\t', false));
				code.push('\t}');
			}
		}
	}
	if (fn.variadic) {
		var isVoid = fn.returns.type === 'void';
		code.push('\tswitch ([args count]) {');
		for (c = fn.arguments.length + 1; c <= MAX_TIMES; c++) {
			code.push('\t\tcase ' + c + ': {');
			code.push(generateObjCResult(state, json, fn, arglist.slice(0, c), asProperty, '\t\t'));
			!isVoid && code.push('\t\t\tbreak;');
			code.push('\t\t}');
		}
		code.push('\t\tdefault: ' + (isVoid ? 'break;' : 'return nil;'));
		code.push('\t}');
	} else {
		code.push(generateObjCResult(state, json, fn, arglist, asProperty));
	}
	code.push('}');
	return code.join('\n');
}

/**
 * Generates the source template data for a module file and it's module
 * objective-c class
 */
function generate(json, mod, state) {
	// for now, skip non frameworks
	if (mod.framework.indexOf('/') >= 0 || mod.customSource) {
		return;
	}
	// generate the objective-c module
	const m = makeModule(json, mod, state);
	const found = json.classes[mod.name];
	m.excludeHeader = !!found;
	if (m.class.properties.length
		|| m.class.class_methods.length
		|| m.class.obj_class_method.length
		|| Object.keys(m.class.static_variables).length
		|| m.class.blocks.length) {
		m.frameworks[mod.framework] = 1;
	}

	return m;
}

exports.generate = generate;

/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015-2018 by Appcelerator, Inc.
 */
'use strict';
const util = require('./util');
const imports = require('./imports');

/**
 * [flattenStruct description]
 * @param  {string} str [description]
 * @return {string}     [description]
 */
function flattenStruct(str) {
	const x = str.indexOf('{');
	const y = str.indexOf('=');
	if (x < 0 || y < 0) {
		// could be just {dd}
		return str.replace(/}/g, '').replace(/{/g, '').trim();
	}
	let r = str.substring(0, x) + str.substring(y + 1);
	const z = r.indexOf('}');
	if (z > 0) {
		// r[z] = '';
		r = r.slice(0, z);
	}
	return flattenStruct(r.trim());
}

/**
 * [createFakeFieldStruct description]
 * @param  {object} prop [description]
 * @return {object}
 */
function createFakeFieldStruct(prop) {
	const otherStruct = {
		name: prop.name,
		fields: []
	};
	// create a fake field struct
	const structenc = flattenStruct(prop.encoding);
	for (var c = 0; c < structenc.length; c++) {
		otherStruct.fields[c] = {
			encoding: structenc[c],
			name: 'f' + c
		};
	}
	return otherStruct;
}

/**
 * [generateFieldGetter description]
 * @param  {object} state [description]
 * @param  {object} json  metabase
 * @param  {object} prop  [description]
 * @param  {number} index [description]
 * @return {string}       [description]
 */
function generateFieldGetter(state, json, prop, index) {
	if (prop.type === 'struct') {
		const code = [];
		const indent = util.repeat('\t', 5);
		code.push('get: function () {');
		code.push(indent + 'return this.$' + prop.name + ';');
		code.push(util.repeat('\t', 4) + '}');
		return code.join('\n');
	} else {
		const wrapper = util.getResultWrapper(state, json, prop, true);
		const endsep = wrapper ? ')' : '';
		return 'get: function () {\n'
				+ util.repeat('\t', 5) + 'return ' + wrapper + '$dispatch(this.$native, \'valueAtIndex:\', ' + index + ')' + endsep + ';\n'
				+ util.repeat('\t', 4) + '}';
	}
}

/**
 * [generateFieldSetter description]
 * @param  {[type]} state [description]
 * @param  {[type]} json  [description]
 * @param  {[type]} prop  [description]
 * @param  {[type]} index [description]
 * @return {[type]}       [description]
 */
function generateFieldSetter(state, json, prop, index) {
	if (prop.type === 'struct') {
		const name = util.getStructNameFromEncoding(prop.encoding);
		let otherStruct = json.structs[name];
		let subWrapper;
		if (!otherStruct) {
			subWrapper = '(';
			// create a fake field struct
			otherStruct = createFakeFieldStruct(prop);
		} else {
			subWrapper = util.getResultWrapper(state, json, { name: otherStruct.name, type: 'struct' }, true);
		}
		const code = [];
		const indent = util.repeat('\t', 5);
		prop.otherStruct = otherStruct;
		code.push('set: function (_' + prop.name + ') {');
		otherStruct.fields.forEach(function (field, i) {
			code.push(indent + 'this.$' + prop.name + '.' + field.name + ' = _' + prop.name + '.' + field.name + ';');
		});
		code.push(util.repeat('\t', 4) + '}');
		return code.join('\n');
	} else {
		return  'set: function (_' + prop.name + ') {\n'
				+ util.repeat('\t', 5) + '$dispatch(this.$native, \'setValue:atIndex:\', [_' + prop.name + ', ' + index + ']);\n'
				+ util.repeat('\t', 4) + '}';
	}
}

function generateStructField(state, json, prop, index) {
	const result = { name: prop.name };
	const sep = util.repeat('\t', 4);
	result.getter = '\t' + generateFieldGetter(state, json, prop, index);
	result.setter = '\n' + sep + generateFieldSetter(state, json, prop, index);
	return result;
}

function makeStruct(json, struct) {
	const entry = {
		class: {
			name: struct.name,
			encoding: '{' + struct.name + '=',
			properties: [],
			ctor_before: [],
			ctor_after: []
		},
		framework: struct.framework,
		filename: struct.filename,
		imports: {},
		renderedImports: ''
	};

	let c = 0;
	struct.fields && struct.fields.forEach(function (field, index) {
		const prop = generateStructField(entry, json, field, index);
		entry.class.properties.push(prop);
		entry.class.encoding += field.encoding;
		if (field.type === 'struct') {
			entry.class.ctor_before.push('this.$' + field.name + ' = {};');
			if (field.otherStruct && field.otherStruct.fields) {
				field.otherStruct.fields.forEach(function (f, i) {
					entry.class.ctor_after.push('Object.defineProperty(this.$' + field.name + ', \'' + f.name + '\', {');
					entry.class.ctor_after.push('\tset: function (_value) {');
					entry.class.ctor_after.push('\t\t$dispatch(pointer, \'setValue:atIndex:\',[_value, ' + c + ']);');
					entry.class.ctor_after.push('\t},');
					entry.class.ctor_after.push('\tget: function () {');
					entry.class.ctor_after.push('\t\treturn $dispatch(pointer, \'valueAtIndex:\', ' + c + ');');
					entry.class.ctor_after.push('\t},');
					entry.class.ctor_after.push('});');
					entry.class.ctor_before.push('if (pointer) {');
					entry.class.ctor_before.push('\tthis.$' + field.name + '.' + f.name + ' = $dispatch(pointer, \'valueAtIndex:\', ' + c + ');');
					entry.class.ctor_before.push('}');
					c++;
				});
			}
		}
	});
	entry.class.encoding += '}';
	entry.renderedImports = imports.makeImports(json, entry.imports);
	return entry;
}

/**
 * Generates the source template data for a struct file
 * @param {object} json metabase
 * @param {object} struct struct from metabase
 * @return {object}
 */
function generate(json, struct) {
	return makeStruct(json, struct);
}

exports.generate = generate;

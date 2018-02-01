/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015 by Appcelerator, Inc.
 */
var util = require('./util');

function generateStructField (state, json, prop, index) {
	var result = {name:prop.name};
	var sep = util.repeat('\t', 4);
	result.getter = '\t' + util.generateFieldGetter(state, json, prop, index);
	result.setter = '\n' + sep + util.generateFieldSetter(state, json, prop, index);
	return result;
}

function makeStruct (json, struct) {
	var entry = {
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

	var c = 0;
	struct.fields && struct.fields.forEach(function (field, index) {
		var prop = generateStructField(entry, json, field, index);
		entry.class.properties.push(prop);
		entry.class.encoding += field.encoding;
		if (field.type === 'struct') {
			entry.class.ctor_before.push('this.$' + field.name + ' = {};');
			if (field.otherStruct && field.otherStruct.fields) {
				field.otherStruct.fields.forEach(function (f, i) {
					entry.class.ctor_after.push('Object.defineProperty(this.$' + field.name+', \'' + f.name +'\', {');
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
	entry.renderedImports = util.makeImports(json, entry.imports);
	return entry;
}

/**
 * Generates the source template data for a struct file
 */
function generate (json, struct) {
	return makeStruct(json, struct);
}

exports.generate = generate;

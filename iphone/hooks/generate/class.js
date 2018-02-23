/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015-2018 by Appcelerator, Inc.
 */
'use strict';
const util = require('./util');
const imports = require('./imports');
const methodlib = require('./method');
const swift = require('hyperloop-metabase').swift;

/**
 * Generates the source template data for a class file
 * (Used to generate a JS wrapper for a class)
 *
 * @param  {object} json  metabase
 * @param  {object} cls   class definition extracted from metabase
 * @param  {ParserState} state parser state tracking references
 * @return {object}
 */
function makeClass(json, cls, state) {
	const entry = {
		class: {
			name: cls.name,
			fqcn: generateFullyQualifiedClassName(cls, state),
			instance_properties: [],
			class_properties: [],
			instance_methods: [],
			class_methods: []
		},
		framework: cls.framework,
		filename: cls.filename,
		imports: {},
		renderedImports: '',
		superclass: cls.superclass && json.classes[cls.superclass],
		state: state
	};
	cls.properties && Object.keys(cls.properties).sort().forEach(function (k) {
		if (!state.isGetterPropertyReferenced(k) && !state.isSetterPropertyReferenced(k)) {
			return;
		}

		let prop;
		if (isClassProperty(cls.properties[k])) {
			prop = generateClassProperty(entry, json, cls.properties[k]);
		} else {
			prop = util.generateProp(entry, json, cls.properties[k]);
		}

		if (!state.isGetterPropertyReferenced(k)) {
			prop.getter = null;
		}
		if (!state.isSetterPropertyReferenced(k)) {
			prop.setter = null;
		}
		if (prop.setter || prop.getter) {
			if (isClassProperty(cls.properties[k])) {
				entry.class.class_properties.push(prop);
			} else {
				entry.class.instance_properties.push(prop);
			}
		}
	});
	cls.methods && Object.keys(cls.methods).sort().forEach(function (k) {
		const method = cls.methods[k];
		if (!methodlib.framework) {
			method.framework = cls.framework;
		}
		if (shouldSkipMethodIfPropertyAvailable(k, cls)) {
			return;
		}
		if (!state.isFunctionReferenced(method.name)) {
			return;
		}
		if (method.instance) {
			entry.class.instance_methods.push(generateInstanceMethod(entry, json, method));
		} else {
			entry.class.class_methods.push(generateClassMethod(entry, json, method));
		}
	});
	entry.renderedImports = imports.makeImports(json, entry.imports);
	return entry;
}

/**
 * Generates the appropriate fully qualified name for a class.
 *
 * This handles cases where we need three different class names:
 *  - The default Objective-C class name
 *  - The mangled class name for Swift classes
 *  - A combination of FrameworkName.ClassName for Objective-C classes that were
 *    impported from the Objective-C interface header of a Swift module.
 *
 * @param {Object} cls Class metadata object
 * @param {Object} state Parser state
 * @return {String} Fully qualified class name
 */
function generateFullyQualifiedClassName(cls, state) {
	let fullyQualifiedClassName = cls.name;
	if (cls.language === 'swift') {
		fullyQualifiedClassName = swift.generateSwiftMangledClassName(state.appName, cls.name);
	} else if (cls.filename === cls.framework + '-Swift.h') {
		fullyQualifiedClassName = cls.framework + '.' + cls.name;
	}

	return fullyQualifiedClassName;
}

/**
 * Decides wether a method should be skipped in favor of its matching property.
 *
 * Return true for methods that have the same name as a property (getter method)
 *
 * @param {String} methodKey
 * @param {Object} classMetadata
 * @param {ParserState} state
 * @return {Boolean}
 */
function shouldSkipMethodIfPropertyAvailable(methodKey, classMetadata) {
	var classMethodMetadata = classMetadata[methodKey];
	var matchingPropertyMetadata = classMetadata.properties && classMetadata.properties[methodKey];
	if (!matchingPropertyMetadata) {
		return false;
	}

	return true;
}

/**
 * Returns whether a property is a class property or not
 *
 * @param {Object} propertyMetadata
 * @param {string[]} [propertyMetadata.attributes]
 * @return {Boolean}
 */
function isClassProperty(propertyMetadata) {
	return propertyMetadata.attributes && propertyMetadata.attributes.indexOf('class') !== -1;
}

/**
 * Generates a view model used in the class template to generate soure
 * code for class level properties
 *
 * @param {Object} templateVariables Holds all variable later used in the template
 * @param {Object} metabase The complete metabase object
 * @param {Object} propertyMeta Meta info for the current property
 * @return {Object} View model used inside the class tempalte
 */
function generateClassProperty(templateVariables, metabase, propertyMeta) {
	const viewModel = { name: propertyMeta.name };
	viewModel.getter = generateClassPropertyGetter(templateVariables, metabase, propertyMeta);
	if (!propertyMeta.attributes || propertyMeta.attributes.indexOf('readonly') < 0) {
		viewModel.setter = generateClassPropertySetter(templateVariables, metabase, propertyMeta);
	}
	return viewModel;
}

/**
 * Generates the code for a class property getter
 *
 * @param {Object} templateVariables Holds all variable later used in the template
 * @param {Object} metabase The complete metabase object
 * @param {Object} propertyMeta Meta info for the current property
 * @return {string} Code for the getter
 */
function generateClassPropertyGetter(templateVariables, metabase, propertyMeta) {
	var wrapper = util.getResultWrapper(templateVariables, metabase, propertyMeta, false);
	var endsep = wrapper ? ')' : '';
	return '\tget: function () {\n'
		+ util.repeat('\t', 5) + 'if (!$init) { $initialize(); }\n'
		+ util.repeat('\t', 5) + 'return ' + wrapper + '$dispatch($class, \'' + (propertyMeta.selector || propertyMeta.name) + '\', null, true)' + endsep + ';\n'
		+ util.repeat('\t', 4) + '}';
}

/**
 * Generates the code for a class property setter
 *
 * @param {Object} templateVariables Holds all variable later used in the template
 * @param {Object} metabase The complete metabase object
 * @param {Object} propertyMeta Meta info for the current property
 * @return {string} Code for the setter
 */
function generateClassPropertySetter(templateVariables, metabase, propertyMeta) {
	return util.repeat('\t', 4) + 'set: function (_' + propertyMeta.name + ') {\n'
		+ util.repeat('\t', 5) + 'if (!$init) { $initialize(); }\n'
		+ util.repeat('\t', 5) + 'this.$private.' + propertyMeta.name + ' = _' + propertyMeta.name + ';\n'
		+ util.repeat('\t', 5) + '$dispatch($class, \'' + util.generateSetterSelector(propertyMeta.name) + '\', _' + propertyMeta.name + ', true);\n'
		+ util.repeat('\t', 4) + '}';
}

/**
 * [generateInstanceMethod description]
 * @param  {object} state  [description]
 * @param  {object} json   metabase
 * @param  {object} method method extracted from metabase
 * @return {string}
 */
function generateInstanceMethod(state, json, method) {
	const code = [],
		preamble = [];

	code.push('\tObject.defineProperty(' + state.class.name + '.prototype, \'' + method.name + '\', {');
	code.push('\t\tvalue: function ' + util.generateArgList(state, json, method.arguments, '(', ')', '()') + ' {');

	var body = methodlib.generateMethodBody(state, json, method, preamble, true, 'this.$native');
	preamble.length && (code.push('\t\t' + preamble.join('\n\t\t')));
	var returnsObject = (body.indexOf('new') !== -1) && (body.indexOf('.constructor(') !== -1);
	var prefix;
	if (returnsObject) {
		code.push(body);
		code.push('\t\t\tvar instance = result;');
		prefix = 'instance';
	} else {
		prefix = 'this';
	}
	if (method.arguments.length) {
		code.push('\t\t\t' + prefix + '.$private.' + method.name + ' = ' + prefix + '.$private.' + method.name + ' || [];');
		method.arguments.forEach(arg => {
			code.push('\t\t\t' + prefix + '.$private.' + method.name + '.push(_' + arg.name + ');');
		});
	}

	if (!returnsObject) {
		code.push(body);
		code.push('\t\t\treturn result;');
	} else {
		code.push('\t\t\treturn instance;');
	}
	code.push('\t\t},');
	code.push('\t\tenumerable: false,');  // don't show in enumeration
	code.push('\t\twritable: true');  // allow to be changed
	code.push('\t});');

	return code.join('\n');
}

/**
 * [generateClassMethod description]
 * @param  {object} state  [description]
 * @param  {object} json   metabase
 * @param  {object} method [description]
 * @return {string}        [description]
 */
function generateClassMethod(state, json, method) {
	var code = [],
		preamble = [];

	code.push('Object.defineProperty(' + state.class.name + ', \'' + method.name + '\', {');
	code.push('\tvalue: function ' + util.generateArgList(state, json, method.arguments, '(', ')', '()') + ' {');
	code.push('\t\tif (!$init) { $initialize(); }');
	var body = methodlib.generateMethodBody(state, json, method, preamble, false, 'this.$class');
	preamble.length && (code.push('\t\t' + preamble.join('\n\t\t')));

	if (method.impl) {
		code.push('\t\treturn ' + body);
	} else {
		code.push(body);
		code.push('\t\treturn result;');
	}
	code.push('\t},');
	code.push('\tenumerable: false,');  // don't show in enumeration
	code.push('\twritable: true');  // allow to be changed
	code.push('});');

	return code.join('\n');
}

exports.generate = makeClass;

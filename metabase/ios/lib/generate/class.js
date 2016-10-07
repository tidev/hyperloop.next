/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015 by Appcelerator, Inc.
 */
var util = require('./util'),
	swift = require('../swift');

function makeClass (json, cls, state) {
	var entry = {
		class: {
			name: cls.name,
			mangledName: cls.language === 'swift' ? swift.generateSwiftMangledClassName(state.appName, cls.name) : cls.name,
			instance_properties: [],
			class_properties: [],
			instance_methods: [],
			class_methods: []
		},
		framework: cls.framework,
		filename: cls.filename,
		imports: {},
		superclass: cls.superclass && json.classes[cls.superclass],
		state: state
	};
	cls.properties && Object.keys(cls.properties).sort().forEach(function (k) {
		var prop;

		if (isClassProperty(cls.properties[k])) {
			prop = util.generateClassProperty(entry, json, cls.properties[k]);
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
		var method = cls.methods[k];
		if (!method.framework) {
			method.framework = cls.framework;
		}
		if (shouldSkipMethodIfPropertyAvailable(k, cls)) {
			return;
		}
		if (!state.isFunctionReferenced(method.name)) {
			return;
		}
		if (method.instance) {
			entry.class.instance_methods.push(util.generateInstanceMethod(entry, json, method));
		} else {
			entry.class.class_methods.push(util.generateClassMethod(entry, json, method));
		}
	});
	entry.imports = util.makeImports(json, entry.imports);
	return entry;
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
 * Returns wether a property is a class property or not
 *
 * @param {Object} propertyMetadata
 * @return {Boolean}
 */
function isClassProperty(propertyMetadata) {
	return propertyMetadata.attributes && propertyMetadata.attributes.indexOf('class') !== -1;
}

/**
 * generate a class file
 */
function generate (dir, json, cls, state) {
	var output = util.generateTemplate('class', {
		data: makeClass(json, cls, state)
	});
	util.generateFile(dir, 'class', cls, output);
}

exports.generate = generate;

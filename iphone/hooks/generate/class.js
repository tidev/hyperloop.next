/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015 by Appcelerator, Inc.
 */
var util = require('./util'),
	swift = require('hyperloop-metabase').swift;

function makeClass (json, cls, state) {
	var entry = {
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
		var prop;

		if (!state.isGetterPropertyReferenced(k) && !state.isSetterPropertyReferenced(k)) {
			return;
		}

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
	entry.renderedImports = util.makeImports(json, entry.imports);
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
	var fullyQualifiedClassName = cls.name;
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
 * Returns wether a property is a class property or not
 *
 * @param {Object} propertyMetadata
 * @return {Boolean}
 */
function isClassProperty(propertyMetadata) {
	return propertyMetadata.attributes && propertyMetadata.attributes.indexOf('class') !== -1;
}

/**
 * Generates the source template data for a class file
 */
function generate (json, cls, state) {
	return makeClass(json, cls, state);
}

exports.generate = generate;

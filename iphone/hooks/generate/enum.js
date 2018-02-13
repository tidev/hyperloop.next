/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2018 by Appcelerator, Inc.
 */
'use strict';

function makeEnum(json, name, enumObj) {
	const entry = {
		enumObj: {
			name: name,
			values: {}
		},
		framework: enumObj.framework,
		filename: enumObj.filename
	};
	Object.keys(enumObj.values).forEach(function (valueName) {
		const shortened = valueName.slice(name.length);
		entry.enumObj.values[valueName] = enumObj.values[valueName];
	});

	return entry;
}

/**
 * Generates the source template data for an enum file
 */
function generate(json, name, enumObj) {
	return makeEnum(json, name, enumObj);
}

exports.generate = generate;

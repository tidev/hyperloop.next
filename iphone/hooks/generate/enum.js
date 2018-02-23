/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2018 by Appcelerator, Inc.
 */
'use strict';

/**
 * Generates the source template data for an enum file
 * @param {string} name enum name
 * @param {object} enumObj enum object extracted from metabase?
 * @return {object}
 */
function makeEnum(name, enumObj) {
	const entry = {
		enumObj: {
			name: name,
			values: {}
		},
		framework: enumObj.framework,
		filename: enumObj.filename
	};
	// Take the values and slice the enum's name prefix off it
	Object.keys(enumObj.values).forEach(valueName => {
		const shortened = valueName.slice(name.length);
		entry.enumObj.values[shortened] = enumObj.values[valueName];
	});

	return entry;
}

exports.generate = makeEnum;

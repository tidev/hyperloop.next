/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015-2018 by Appcelerator, Inc.
 */
'use strict';

module.exports = require('./lib');

// map these so that the plugin can use them
[ 'chalk', 'async' ].forEach(function (k) {
	Object.defineProperty(module.exports, k, {
		get: function () {
			return require(k); // eslint-disable-line security/detect-non-literal-require
		}
	});
});

/**
 * Hyperloop ® plugin for Windows
 * Copyright (c) 2015-2017 by Appcelerator, Inc.
 * All Rights Reserved. This library contains intellectual
 * property protected by patents and/or patents pending.
 */
'use strict';

/** The plugin's identifier */
exports.id = 'hyperloop';

/** The Titanium CLI version that this hook is compatible with */
exports.cliVersion = '>=3.2';

(function () {
	// Hyperloop Build for Windows
	function HyperloopWindowsBuilder (logger, config, cli, appc, hyperloopConfig, builder) {

	}

	HyperloopWindowsBuilder.prototype.init = function (next) {
		next();
	};

	module.exports = HyperloopWindowsBuilder;
})();

/**
 * Hyperloop ®
 * Copyright (c) 2015-Present by Appcelerator, Inc.
 * All Rights Reserved. This library contains intellectual
 * property protected by patents and/or patents pending.
 */

'use strict';

const fs = require('fs'),
	path = require('path');

exports.id = 'com.appcelerator.hyperloop';
exports.cliVersion = '>=3.2';
exports.init = init;

/**
 * Main entry point for our plugin which looks for the platform specific
 * plugin to invoke.
 *
 * A priority of 1300 makes sure the Hyperloop plugin starts only after the
 + Android .aar transform hook and the framework integration hook on iOS. The
 + Hyperloop platform specific plugins require data from those hooks and that
 + makes sure they run in the right order.
 *
 * @param {Object} logger - The Titanium CLI logger.
 * @param {Object} config - The Titanium CLI config.
 * @param {Object} cli - The Titanium CLI instance.
 * @param {Object} appc - Reference to node-appc.
 */
function init(logger, config, cli, appc) {
	cli.on('build.pre.compile', {
		priority: 1300,
		post: function (builder, callback) {
			const hook = cli.createHook('hyperloop:init', builder, function (finished) {
				const platform = builder.platformName;
				const deploymentTargets = builder.tiapp && builder.tiapp['deployment-targets'];

				// see if we have a platform specific hyperloop and we're running for that target
				if (deploymentTargets && (deploymentTargets[platform] || deploymentTargets['ipad'])) {
					const usingHyperloop = builder.tiapp.modules.some(function (m) {
						return m.id === 'hyperloop' && (!m.platform || m.platform.indexOf(platform) !== -1);
					});

					// make sure we have the module configured for hyperloop
					if (usingHyperloop) {
						const name = /^iphone|ios$/i.test(platform) ? 'ios' : platform,
							platformHookFile = path.join(__dirname, name, 'hyperloop.js');

						// see if we have the plugin installed
						if (fs.existsSync(platformHookFile)) {
							const cfg = loadConfig(builder.projectDir).hyperloop || {};
							const Builder = require(platformHookFile); // eslint-disable-line security/detect-non-literal-require
							const instance = new Builder(logger, config, cli, appc, cfg, builder);
							return instance.init(finished);
						}

						logger.error('Hyperloop is currently configured but the module has not be installed.');
						logger.error('Add the following to your tiapp.xml:');
						logger.error('');
						logger.error('	<modules>');
						logger.error('		<module platform="' + platform + '">hyperloop</module>');
						logger.error('	</modules>\n');
						process.exit(1);
					}
				}

				finished();
			});

			hook(callback);
		}
	});
}

/**
 * merge b into a
 * @param {Object} a Object to have properties merged into
 * @param {Object} b Object whose properties will get merged into a
 * @return {void}
 */
function merge(a, b) {
	const obj = b || {};
	for (let k in obj) {
		if (obj.hasOwnProperty(k)) {
			a[k] = obj[k];
		}
	}
}

/**
 * load the appc configuration
 * @param {String} dir configuration directory path
 * @return {Object}
 */
function loadConfig(dir) {
	const baseConfig = path.join(dir, 'appc.js'),
		localConfig = path.join(dir, '.appc.js'),
		userConfig = path.join(process.env.HOME || process.env.USERPROFILE, '.appc.js'),
		config = {};

	fs.existsSync(baseConfig) && merge(config, require(baseConfig)); // eslint-disable-line security/detect-non-literal-require
	fs.existsSync(localConfig) && merge(config, require(localConfig)); // eslint-disable-line security/detect-non-literal-require
	fs.existsSync(userConfig) && merge(config, require(userConfig)); // eslint-disable-line security/detect-non-literal-require

	return config;
}

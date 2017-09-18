/**
 * Hyperloop ®
 * Copyright (c) 2015-Present by Appcelerator, Inc.
 * All Rights Reserved. This library contains intellectual
 * property protected by patents and/or patents pending.
 */

'use strict';

var fs = require('fs'),
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
			var hook = cli.createHook('hyperloop:init', builder, function (finished) {
				var platform = builder.platformName;
				var deploymentTargets = builder.tiapp && builder.tiapp['deployment-targets'];

				// see if we have a platform specific hyperloop and we're running for that target
				if (deploymentTargets && (deploymentTargets[platform] || deploymentTargets['ipad'])) {
					var usingHyperloop = builder.tiapp.modules.some(function (m) {
						return m.id === 'hyperloop' && (!m.platform || m.platform.indexOf(platform) !== -1);
					});

					// make sure we have the module configured for hyperloop
					if (usingHyperloop) {
						var name = /^iphone|ios$/i.test(platform) ? 'ios' : platform,
							platformHookFile = path.join(__dirname, name, 'hyperloop.js');

						// see if we have the plugin installed
						if (fs.existsSync(platformHookFile)) {
							var cfg = loadConfig(builder.projectDir).hyperloop || {};
							var Builder = require(platformHookFile);
							var instance = new Builder(logger, config, cli, appc, cfg, builder);
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
 */
 function merge(a, b) {
	 var obj = b || {};
	 for (var k in obj) {
		 if (obj.hasOwnProperty(k)) {
			 a[k] = obj[k];
		 }
	 }
 }

/**
 * load the appc configuration
 */
function loadConfig(dir) {
	var baseConfig = path.join(dir, 'appc.js'),
		localConfig = path.join(dir, '.appc.js'),
		userConfig = path.join(process.env.HOME || process.env.USERPROFILE, '.appc.js'),
		config = {};

	fs.existsSync(baseConfig) && merge(config, require(baseConfig));
	fs.existsSync(localConfig) && merge(config, require(localConfig));
	fs.existsSync(userConfig) && merge(config, require(userConfig));

	return config;
}

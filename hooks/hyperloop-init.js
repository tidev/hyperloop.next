'use strict';

const fs = require('fs');
const path = require('path');

exports.id = 'com.appcelerator.hyperloop';
exports.cliVersion = '>=3.2';
exports.init = (logger, config, cli, appc) => {
	cli.on('build.pre.compile', {
		priority: 1300,
		post: function (builder, callback) {
			const factory = new HyperloopBuilderFactory(logger, config, cli, appc, builder);
			const instance = factory.createHyperloopBuilder();
			instance.init(callback);
		}
	});
};

class HyperloopBuilderFactory {
	constructor(logger, config, cli, appc, builder) {
		this.logger = logger;
		this.config = config;
		this.cli = cli;
		this.appc = appc;
		this.builder = builder;
	}

	createHyperloopBuilder() {
		const hyperloopConfig = this.loadConfiguration();
		const platformHookFile = path.join(__dirname, 'hyperloop.js');

		if (!fs.existsSync(platformHookFile)) {
			this.logger.error(`Hyperloop builder not found at expected path ${platformHookFile}.`);
			process.exit(1);
		}

		var Builder = require(platformHookFile);
		return new Builder(this.logger, this.config, this.cli, this.appc, hyperloopConfig, this.builder);
	}

	loadConfiguration() {
		const possibleConfigurtionFiles = [
			path.join(this.builder.projectDir, 'appc.js'),
			path.join(this.builder.projectDir, '.appc.js'),
			path.join(process.env.HOME || process.env.USERPROFILE, '.appc.js')
		];
		let config = {};

		for (let configurationFile of possibleConfigurtionFiles) {
			if (fs.existsSync(configurationFile)) {
				this.mergeObjectProperties(config, require(configurationFile));
			}
		}

		return config;
	}

	mergeObjectProperties(target, source) {
		if (!source) {
			return;
		}

		for (var k in source) {
			if (source.hasOwnProperty(k)) {
				target[k] = source[k];
			}
		}
	}
}

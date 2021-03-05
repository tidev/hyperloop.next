'use strict';

const BaseFileTask = require('appc-tasks').BaseFileTask;
const fs =  require('fs-extra');
const metabase = require('../metabase');

/**
 * A task that will generate the Android metabase
 *
 * This is implemented as a simple base task because the metabase generation
 * itself has a caching machanisim, so we just delegate and return the result.
 */
class GenerateMetabaseTask extends BaseFileTask {

	/**
	 * Constructs a new task for metabase generation
	 *
	 * @param {Object} taskInfo
	 */
	constructor(taskInfo) {
		super(taskInfo);

		this._builder = null;
		this._metabase = null;
	}

	/**
	 * Gets the output directory where the metabase JSON will be written to.
	 *
	 * @return {String} Full path to the output directory.
	 */
	 get outputDirectory() {
		return this._outputDirectory;
	}

	/**
	 * Sets the output directory where the metabase JSON file will be written to.
	 *
	 * @param {String} outputPath Full path to the output directory.
	 */
	set outputDirectory(outputPath) {
		this._outputDirectory = outputPath;
	}

	/**
	 * Sets the AndroidBuilder instance
	 *
	 * @param {AndroidBuilder} builder
	 */
	set builder(builder) {
		this._builder = builder;
	}

	/**
	 * Gets the generated metabse
	 *
	 * @return {Object} Metabase object
	 */
	get metabase() {
		return this._metabase;
	}

	/**
	 * Starts the metabase generation by delegating to the existing metabase loader
	 *
	 * @return {Promise}
	 */
	async runTaskAction() {
		const inputFiles = Array.from(this.inputFiles);
		this.logger.trace('Generating metabase for JARs: ' + inputFiles);

		const options = {
			platform: 'android-' + this._builder.realTargetSDK
		};
		if (this._outputDirectory) {
			await fs.ensureDir(this._outputDirectory);
			options.cacheDir = this._outputDirectory;
		}

		return new Promise((resolve, reject) => {
			metabase.metabase.loadMetabase(inputFiles, options, (err, json) => {
				if (err) {
					this.logger.error('Failed to generated metabase: ' + err);
					return reject(err);
				}
				this._metabase = json;
				resolve();
			});
		});
	}

}

module.exports = GenerateMetabaseTask;

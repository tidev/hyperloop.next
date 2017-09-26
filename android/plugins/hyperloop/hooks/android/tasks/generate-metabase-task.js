const BaseFileTask = require('appc-tasks').BaseFileTask;
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
	 * @param {Object} taskInfo task info
	 */
	constructor(taskInfo) {
		super(taskInfo);

		this._builder = null;
		this._metabase = null;
	}

	/**
	 * Sets the AndroidBuilder instance
	 *
	 * @param {AndroidBuilder} builder AndroidBuilder instance
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
	runTaskAction() {
		const inputFiles = Array.from(this.inputFiles);
		this.logger.trace('Generating metabase for JARs: ' + inputFiles);
		return new Promise((resolve, reject) => {
			metabase.metabase.loadMetabase(inputFiles, { platform: 'android-' + this._builder.realTargetSDK }, (err, json) => {
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

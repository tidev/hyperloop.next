const BaseTask = require('./base-task');
const metabase = require('../../metabase');

/**
 * A task that will generate the Android metabase
 *
 * This is implemented as a simple base task because the metabase generation
 * itself has a caching machanisim, so we just delegate and return the result.
 */
class GenerateMetabaseTask extends BaseTask {

	constructor(taskInfo) {
		super(taskInfo);

		this._builder = null;
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
	 * Starts the metabase generation by delegating to the existing metabase loader
	 *
	 * @return {Promise}
	 */
	runTaskAction() {
		this.logger.trace(this.name + ': Generating metabase for JARs: ' + this.inputFiles);
		return new Promise((resolve, reject) => {
			metabase.metabase.loadMetabase(this.inputFiles, {platform: 'android-' + this._builder.realTargetSDK}, (err, json) => {
				if (err) {
					this.logger.error(this.name + ': Failed to generated metabase: ' + err);
					return reject(err);
				}
				resolve(json);
			});
		});
	}

}

module.exports = GenerateMetabaseTask;

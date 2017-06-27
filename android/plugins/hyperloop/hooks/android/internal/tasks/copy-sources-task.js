const fs = require('fs-extra');
const IncrementalTask = require('./incremental-task');
const path = require('path');

/**
 * Task to copy all generated Hyperloop wrappers into the app's Resources
 * directory
 *
 * TODO: Include minification here? Or move it to own incremental task so we
 * don't have to do it over and over agin?
 *
 * @type {[type]}
 */
class CopySourcesTask extends IncrementalTask {

	constructor(taskInfo) {
		super(taskInfo);

		this.inputDirectory = taskInfo.inputDirectory;
		//this.minifyJs = taskInfo.minifyJs;
	}

	get incrementalOutputs() {
		return [this.outputDirectory];
	}

	/**
	 * Does full task run, wich will empty the output directory and copy all
	 * available wrappers into it
	 *
	 * @return {Promise}
	 */
	doFullTaskRun() {
		fs.emptyDirSync(this.outputDirectory);

		return new Promise((resolve, reject) => {
			fs.copy(this.inputDirectory, this.outputDirectory, err => {
				if (err) {
					reject(err);
				}

				resolve();
			});
		});
	}

	/**
	 * Does an incremental task run, which will sync the output directory based
	 * on the changed input file states
	 *
	 * @param {Map} changedFiles Map of changed files and their state (new, changed, removed)
	 * @return {Promise}
	 */
	doIncrementalTaskRun(changedFiles) {
		let syncPromises = [];
		changedFiles.forEach((state, pathAndFilename) => {
			let promise = new Promise((resolve, reject) => {
				let destinationPathAndFilename = path.join(this.outputDirectory, path.basename(pathAndFilename));
				if (state === 'new' || state === 'changed') {
					fs.copy(pathAndFilename, destinationPathAndFilename, err => {
						if (err) {
							reject(err);
						}

						resolve();
					});
				} else if (state === 'removed') {
					fs.remove(destinationPathAndFilename, err => {
						if (err) {
							reject(err);
						}

						resolve();
					});
				}
			});
			syncPromises.push(promise);
		});

		return Promise.all(syncPromises);
	}

}

module.exports = CopySourcesTask;

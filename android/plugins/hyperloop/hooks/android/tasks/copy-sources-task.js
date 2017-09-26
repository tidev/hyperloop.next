const fs = require('fs-extra');
const IncrementalFileTask = require('appc-tasks').IncrementalFileTask;
const babel = require('babel-core');
const minify = require('babel-preset-minify');
const path = require('path');

/**
 * Task to copy all generated Hyperloop wrappers into the app's Resources
 * directory
 */
class CopySourcesTask extends IncrementalFileTask {

	/**
	 * Constructs a new task for copying the Hyperloop wrapper sources
	 *
	 * @param {Object} taskInfo task info
	 */
	constructor(taskInfo) {
		super(taskInfo);

		this._sourceDirectory = null;
		this._outputDirectory = null;
		this._builder = null;
	}

	/**
	 * @inheritdoc
	 */
	get incrementalOutputs() {
		return [ this.outputDirectory ];
	}

	/**
	 * Gets the source directory path
	 *
	 * @return {String}
	 */
	get sourceDirectory() {
		return this._sourceDirectory;
	}

	/**
	 * Sets the directory that contains the Hyperloop wrapper source files
	 *
	 * @param {String} sourceDirectory Full path to the source directory
	 */
	set sourceDirectory(sourceDirectory) {
		if (this._sourceDirectory !== null) {
			throw new Error('The source directory can only be set once.');
		}

		this._sourceDirectory = sourceDirectory;
		this.addInputDirectory(this._sourceDirectory);
	}

	/**
	 * Gets the output directory where all wrappers will be copied to
	 *
	 * @return {String} Full path to the output directory
	 */
	get outputDirectory() {
		return this._outputDirectory;
	}

	/**
	 * Sets the out directory where all wrappers will be copied to
	 *
	 * @param {String} outputPath Full path to the output directory
	 */
	set outputDirectory(outputPath) {
		fs.ensureDirSync(outputPath);
		this._outputDirectory = outputPath;
		this.registerOutputPath(this.outputDirectory);
	}

	/**
	 * Sets the android builder
	 *
	 * @param {Object} builder Android builder instance
	 */
	set builder(builder) {
		this._builder = builder;
	}

	/**
	 * Returns wether the Hyperloop source should be minified before copying
	 *
	 * @return {boolean} True if the sources should be minified, false if not
	 */
	shouldMinifiyJs() {
		return this._builder.minifyJS;
	}

	/**
	 * Does full task run, wich will empty the output directory and copy all
	 * available wrappers into it
	 *
	 * @return {Promise}
	 */
	doFullTaskRun() {
		fs.emptyDirSync(this.outputDirectory);

		if (this.shouldMinifiyJs()) {
			const sourceFiles = fs.readdirSync(this.sourceDirectory);
			return Promise.all(sourceFiles.map(sourceFilename => {
				const sourcePathAndFilename = path.join(this.sourceDirectory, sourceFilename);
				const destinationPathAndFilename = path.join(this.outputDirectory, sourceFilename);
				return this.minifyJsAndWrite(sourcePathAndFilename, destinationPathAndFilename);
			}));
		} else {
			return this.copy(this.sourceDirectory, this.outputDirectory);
		}
	}

	/**
	 * Does an incremental task run, which will sync the output directory based
	 * on the changed input file states
	 *
	 * @param {Map} changedFiles Map of changed files and their state (new, changed, removed)
	 * @return {Promise}
	 */
	doIncrementalTaskRun(changedFiles) {
		const fullBuild = !this.canDoIncrementalRun();
		if (fullBuild) {
			return this.doFullTaskRun();
		}

		let syncPromises = [];
		changedFiles.forEach((state, pathAndFilename) => {
			const promise = new Promise((resolve, reject) => {
				const destinationPathAndFilename = path.join(this.outputDirectory, path.basename(pathAndFilename));
				if (state === 'created' || state === 'changed') {
					if (this.shouldMinifiyJs()) {
						this.minifyJsAndWrite(pathAndFilename, destinationPathAndFilename).then(resolve, reject);
					} else {
						this.copy(pathAndFilename, destinationPathAndFilename).then(resolve, reject);
					}
				} else if (state === 'deleted') {
					fs.remove(destinationPathAndFilename, err => {
						if (err) {
							return reject(err);
						}

						resolve();
					});
				}
			});
			syncPromises.push(promise);
		});

		return Promise.all(syncPromises);
	}

	/**
	 * Checks wether the task can apply changes in an incremental manner or if it
	 * needs to fallback to a full task run.
	 *
	 * This will detect changes to the deploy type and the skip-js-minify cli options
	 * as those change the value of the minifyJS setting. To avoid mixing minified
	 * and un-minified files a full task run is required in those cases.
	 *
	 * @return {Boolean} True if the changes can be applied incrementally, false if a full run is required
	 */
	canDoIncrementalRun() {
		const buildManifest = this._builder.buildManifest;

		if (buildManifest.deployType !== this._builder.deployType) {
			this.logger.trace(`Deploy type changed from ${buildManifest.deployType} to ${this._builder.deployType}, doing full task run.`);
			return false;
		}

		if (buildManifest.skipJSMinification !== !!this._builder.cli.argv['skip-js-minify']) {
			this.logger.trace('Skip JS minify setting changed from %s to %s, doing full task run.', buildManifest.skipJSMinification, !!this._builder.cli.argv['skip-js-minify']);
			return false;
		}

		return true;
	}

	/**
	 * Copies everything under sourcePath to destinationPath
	 *
	 * Basically just a promisified version of fs.copy
	 *
	 * @param {String} sourcePath Full path to the source file or directory
	 * @param {String} destinationPath Full path to the destination file or directory
	 * @return {Promise}
	 */
	copy(sourcePath, destinationPath) {
		return new Promise((resolve, reject) => {
			fs.copy(sourcePath, destinationPath, err => {
				if (err) {
					reject(err);
				}

				resolve();
			});
		});
	}

	/**
	 * Reads the content from the source file, minifies it using babel and then
	 * writes the minifed code to the new destination file
	 *
	 * @param {String} sourcePath Full path to the source file
	 * @param {String} destinationPath Full path to the destination file
	 * @return {Promise}
	 */
	minifyJsAndWrite(sourcePath, destinationPath) {
		return new Promise(
			(resolve, reject) => {
				babel.transformFile(sourcePath, {
					minified: true,
					compact: true,
					comments: false,
					presets: [ minify ]
				}, (err, result) => {
					if (err) {
						return reject(err);
					}

					resolve(result);
				});
			})
			.then(transformResult => {
				return new Promise((resolve, reject) => {
					fs.ensureDirSync(path.dirname(destinationPath));
					fs.writeFile(destinationPath, transformResult.code, (err) => {
						if (err) {
							return reject(err);
						}

						return resolve();
					});
				});
			});
	}

}

module.exports = CopySourcesTask;

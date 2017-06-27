const fs = require('fs-extra');
const IncrementalTask = require('./incremental-task');
const metabase = require('../../metabase');
const path = require('path');

/**
 * Generates Hyperloop wrapper files for all Java classes being referenced
 */
class GenerateSourcesTask extends IncrementalTask {

	constructor(taskInfo) {
		super(taskInfo);

		this._metabase = null;
		this._references = null;
		this._classListPathAndFilename = path.join(this.incrementalDirectory, 'classes.json');
		this._generatedClasses = [];
	}

	/**
	 * Metabase that will be used to genrate the warpper files
	 *
	 * @return {Object} Metabase object
	 */
	get metabase() {
		return this._metabase;
	}

	/**
	 * Sets the metabase object
	 *
	 * @param {Object} metabase
	 */
	set metabase(metabase) {
		this._metabase = metabase;
	}

	/**
	 * Mapping of source files and their referenced Java types
	 *
	 * @return {Map}
	 */
	get references() {
		return this._references;
	}

	/**
	 * Sets the Java type reference map
	 *
	 * @param {Map} references
	 */
	set references(references) {
		this._references = references;
	}

	get incrementalOutputs() {
		return [this.outputDirectory, this._classListPathAndFilename];
	}

	/**
	 * Does full task run, wich will generate the Hyperloop wrapper for every
	 * referencced Java class
	 *
	 * @return {Promise}
	 */
	doFullTaskRun() {
		fs.emptyDirSync(this.outputDirectory);

		if (this.references.size === 0) {
			this._logger.info('Skipping Hyperloop wrapper generation, no usage found ...');
			return Promise.resolve();
		}

		let classesToGenerate = [];
		this.references.forEach(fileInfo => {
			fileInfo.usedClasses.forEach(className => {
				if (classesToGenerate.indexOf(className) === -1) {
					classesToGenerate.push(className);
				}
			});
		});

		return this.generateSources(classesToGenerate).then(this.writeClassList.bind(this));
	}

	/**
	 * Does an incremental task run, which will generate the Hyperloop wrappers
	 * for new and changed files and delete the wrapper for removed references.
	 *
	 * To properly detect removed references we store a list with the name of all
	 * generated wrapper files and compare that with the currently referenced ones.
	 * Any wrapper file that is not referenced anymore will be deleted.
	 *
	 * @param {Map} changedFiles Map of changed files and their state (new, changed, removed)
	 * @return {Promise}
	 */
	doIncrementalTaskRun(changedFiles) {
		let fullBuild = !this.loadClassList();
		if (fullBuild) {
			return this.doFullTaskRun();
		}

		let classesToGenerate = [];
		let referencedClasses = [];

		this.references.forEach((fileInfo, pathAndFilename) => {
			fileInfo.usedClasses.forEach(className => {
				if (referencedClasses.indexOf(className) === -1) {
					referencedClasses.push(className);
				}
			});

			var fileState = changedFiles.get(pathAndFilename);
			if (fileState === undefined) {
				return;
			}
			if (fileState === 'new' || fileState === 'changed') {
				this.references[pathAndFilename].usedClasses.forEach(className => {
					if (this._generatedClasses.indexOf(className) !== -1) {
						return;
					}

					if (classesToGenerate.indexOf(className) === -1) {
						classesToGenerate.push(this.references[pathAndFilename].usedClasses);
					}
				});
			}
		});

		this._generatedClasses = this._generatedClasses.filter(className => {
			if (referencedClasses.indexOf(className) === -1) {
				let wrapperPathAndFilename = path.join(this.outputDirectory, className + '.js');
				if (fs.existsSync(wrapperPathAndFilename)) {
					fs.unlinkSync(wrapperPathAndFilename);
				}
				return false;
			}
			return true;
		});

		return this.generateSources(classesToGenerate).then(this.writeClassList.bind(this));
	}

	/**
	 * Generates the wrapper source files by delegating to the generator inside
	 * the metabase module
	 *
	 * @param {Array} classes List of classes to generate the sources for
	 * @return {Promise}
	 */
	generateSources(classes) {
		if (classes.length === 0) {
			return Promise.resolve();
		}

		return new Promise((resolve, reject) => {
			metabase.generate.generateFromJSON(this.outputDirectory, this.metabase, classes, (err) => {
				if (err) {
					reject(err);
				}

				this._generatedClasses = this._generatedClasses.concat(classes);

				resolve();
			});
		});
	}

	/**
	 * Loads the class list used in incremental task runs
	 *
	 * @return {boolean} True if the files was loaded succesfully, false otherwise
	 */
	loadClassList() {
		if (!fs.existsSync(this._classListPathAndFilename)) {
			return false;
		}

		try {
			this._generatedClasses = JSON.parse(fs.readFileSync(this._classListPathAndFilename));
			return true;
		} catch (e) {
			return false;
		}
	}

	/**
	 * Stores the list of all currently generated Hyperloop class wrappers
	 *
	 * @return {Promise}
	 */
	writeClassList() {
		return new Promise((resolve, reject) => {
			fs.writeFile(this._classListPathAndFilename, JSON.stringify(this._generatedClasses), (err) => {
				if (err) {
					reject(err);
				}

				resolve();
			});
		});
	}

}

module.exports = GenerateSourcesTask;

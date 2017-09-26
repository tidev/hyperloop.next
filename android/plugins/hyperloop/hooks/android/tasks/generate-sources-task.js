const fs = require('fs-extra');
const IncrementalFileTask = require('appc-tasks').IncrementalFileTask;
const metabase = require('../metabase');
const path = require('path');

/**
 * Generates Hyperloop wrapper files for all Java classes being referenced
 */
class GenerateSourcesTask extends IncrementalFileTask {

	constructor(taskInfo) {
		super(taskInfo);

		this._metabase = null;
		this._references = null;
		this._classListPathAndFilename = path.join(this.incrementalDirectory, 'classes.json');
		this._generatedClasses = new Set();
	}

	/**
	 * Gets the output directory where all wrappers will be generate to
	 *
	 * @return {String} Full path to the output directory
	 */
	get outputDirectory() {
		return this._outputDirectory;
	}

	/**
	 * Sets the out directory where all wrappers will be generate to
	 *
	 * @param {String} outputPath Full path to the output directory
	 */
	set outputDirectory(outputPath) {
		fs.ensureDirSync(outputPath);
		this._outputDirectory = outputPath;
		this.registerOutputPath(this.outputDirectory);
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
	 * @param {Object} metabase metabase object
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
	 * @param {Map} references java type reference map
	 */
	set references(references) {
		this._references = references;
	}

	/**
	 * @inheritdoc
	 */
	get incrementalOutputs() {
		return [ this.outputDirectory, this._classListPathAndFilename ];
	}

	/**
	 * Does a full task run, wich will generate the Hyperloop wrapper for every
	 * referenced Java class
	 *
	 * @return {Promise}
	 */
	doFullTaskRun() {
		fs.emptyDirSync(this.outputDirectory);

		if (this.references.size === 0) {
			this._logger.info('Skipping Hyperloop wrapper generation, no usage found ...');
			return Promise.resolve();
		}

		const classesToGenerate = metabase.generate.expandDependencies(this.metabase, this.getAllReferencedClasses());

		return this.generateSources(classesToGenerate, [])
			.then(() => {
				this._generatedClasses = new Set(classesToGenerate);
			})
			.then(() => this.writeClassList());
	}

	/**
	 * Does an incremental task run, which will generate the Hyperloop wrappers
	 * for new and changed files and delete the wrapper for removed references.
	 *
	 * To properly detect removed references we store a list with the name of all
	 * previously generated wrapper files and compare that with the ones that were
	 * generated in the current run. Any wrapper file that is not used
	 * anymore will be deleted.
	 *
	 * @param {Map.<String, String>} changedFiles Map of changed files and their state (created, changed, deleted)
	 * @return {Promise}
	 */
	doIncrementalTaskRun(changedFiles) { // eslint-disable-line no-unused-vars
		const fullBuild = !this.loadClassList();
		if (fullBuild) {
			return this.doFullTaskRun();
		}

		const expandedClassList = metabase.generate.expandDependencies(this.metabase, this.getAllReferencedClasses());
		const classesToGenerate = expandedClassList.filter(className => !this._generatedClasses.has(className));
		const classesToRemove = Array.from(this._generatedClasses).filter(className => expandedClassList.indexOf(className) === -1);

		return this.removeUnusedClasses(classesToRemove)
			.then(() => this.generateSources(classesToGenerate, classesToRemove))
			.then(() => {
				classesToGenerate.forEach(className => this._generatedClasses.add(className));
				classesToRemove.forEach(className => this._generatedClasses.delete(className));
			})
			.then(() => this.writeClassList());
	}

	/**
	 * Gets a list of all referenced native types
	 *
	 * @return {Array.<String>} Array of referenced native types
	 */
	getAllReferencedClasses() {
		let referencedClasses = [];
		this.references.forEach(fileInfo => {
			referencedClasses = referencedClasses.concat(fileInfo.usedClasses);
		});
		return referencedClasses;
	}

	/**
	 * Removes any unused class wrappers from the output directoy
	 *
	 * @param {Array.<String>} classesToRemove Array of class names
	 * @return {Promise}
	 */
	removeUnusedClasses(classesToRemove) {
		return Promise.all(classesToRemove.map(className => {
			return new Promise(resolve => {
				let classPathAndFilename = path.join(this.outputDirectory, className + '.js');
				fs.unlink(classPathAndFilename, () => resolve());
			});
		}));
	}

	/**
	 * Generates the wrapper source files by delegating to the generator inside
	 * the metabase module
	 *
	 * @param {Array.<String>} classesToGenerate Array of classes to generate sources for
	 * @param {Array.<String>} removedClasses Array of classes that were removed
	 * @return {Promise}
	 */
	generateSources(classesToGenerate, removedClasses) {
		if (classesToGenerate.length === 0 && removedClasses.length === 0) {
			this.logger.trace('All class wrappers are up-to-date.');
			return Promise.resolve();
		}

		return new Promise((resolve, reject) => {
			const options = {
				classesToGenerate: classesToGenerate,
				removedClasses: removedClasses,
				existingClasses: Array.from(this._generatedClasses)
			};
			metabase.generate.generateFromJSON(this.outputDirectory, this.metabase, options, (err, generatedClasses) => { // eslint-disable-line no-unused-vars
				if (err) {
					return reject(err);
				}

				resolve();
			});
		});
	}

	/**
	 * Loads the class list used in incremental task runs
	 *
	 * @return {Boolean} True if the files was loaded succesfully, false if not
	 */
	loadClassList() {
		if (!fs.existsSync(this._classListPathAndFilename)) {
			return false;
		}

		try {
			this._generatedClasses = new Set(JSON.parse(fs.readFileSync(this._classListPathAndFilename)));
			return true;
		} catch (e) {
			this.logger.trace('Loading class list failed: ' + e);
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
			fs.writeFile(this._classListPathAndFilename, JSON.stringify(Array.from(this._generatedClasses)), (err) => {
				if (err) {
					return reject(err);
				}

				resolve();
			});
		});
	}

}

module.exports = GenerateSourcesTask;

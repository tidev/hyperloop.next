const fs =  require('fs-extra');
const IncrementalFileTask = require('appc-tasks').IncrementalFileTask;
const path = require('path');

const REFERENCES_FILENAME = 'references.json';

/**
 * Scans JavaScript files for any references to Hyperloop wrappers by checking
 * any requires against our available classes in the metabase.
 *
 * This references are used so we know what wrappers to generate. In addition
 * this will replace the requires from their Java class name to their actual
 * Hyperloop wrapper file and save that new file content so we can reuse it
 * on incremental builds.
 */
class ScanReferencesTask extends IncrementalFileTask {

	constructor(taskInfo) {
		super(taskInfo);

		this._referencesPathAndFilename = null;
		this._references = new Map();
		this._metabase = null;
	}

	/**
	 * Gets the output directory where reference data will be stored.
	 *
	 * @return {String} Full path to the output directory
	 */
	get outputDirectory() {
		return this._outputDirectory;
	}

	/**
	 * Sets the output directory where the references cache file will be generated
	 * to.
	 *
	 * @param {String} outputPath Full path to the output directory
	 */
	set outputDirectory(outputPath) {
		fs.ensureDirSync(outputPath);
		this._outputDirectory = outputPath;
		this.registerOutputPath(this.outputDirectory);
		this._referencesPathAndFilename = path.join(this.outputDirectory, REFERENCES_FILENAME);
	}

	/**
	 * Gets the metabase data used to check if a require refers to an existing
	 * Java type
	 *
	 * @return {Object}
	 */
	get metabase() {
		return this._metabase;
	}

	/**
	 * Sets the metabase data
	 *
	 * @param {Object} metabase Metabase object
	 */
	set metabase(metabase) {
		this._metabase = metabase;
	}

	/**
	 * Gets the Hyperloop references metadata found across all source files
	 *
	 * @return {Map.<String, Object>} Map of filenames and Hyperloop references metadata
	 */
	get references() {
		return this._references;
	}

	/**
	 * @inheritdoc
	 */
	get incrementalOutputs() {
		return [ this.outputDirectory ];
	}

	/**
	 * Does a full task run, which scans all input files for Hyperloop related
	 * require statements
	 *
	 * @return {Promise}
	 */
	doFullTaskRun() {
		fs.emptyDirSync(this.outputDirectory);
		this.inputFiles.forEach(pathAndFilename => {
			this.scanFileForHyperloopRequires(pathAndFilename);
		});
		this.writeReferences();

		return Promise.resolve();
	}

	/**
	 * Does an incremental task run, which only scans the changed files for any
	 * Hyperloop related require statements and updates the reference map. Also
	 * removes any references from files that were deleted.
	 *
	 * @param {Map} changedFiles Map of changed files and their state (created, changed, deleted)
	 * @return {Promise}
	 */
	doIncrementalTaskRun(changedFiles) {
		const fullBuild = !this.loadReferences();
		if (fullBuild) {
			return this.doFullTaskRun();
		}

		changedFiles.forEach((state, pathAndFilename) => {
			if (state === 'created' || state === 'changed') {
				const hyperloopUsed = this.scanFileForHyperloopRequires(pathAndFilename);
				if (!hyperloopUsed) {
					this._references.delete(pathAndFilename);
				}
			} else if (state === 'deleted') {
				this._references.delete(pathAndFilename);
			}
		});
		this.writeReferences();

		return Promise.resolve();
	}

	/**
	 * If nothing changed load the existing references from file and return them
	 *
	 * @return {Promise}
	 */
	loadResultAndSkip() {
		const loaded = this.loadReferences();
		if (loaded) {
			return Promise.resolve();
		} else {
			return this.doFullTaskRun();
		}
	}

	/**
	 * Loads references of the last build from file.
	 *
	 * @return {boolean} True if the reference file was succesfully loaded, otherwise false
	 */
	loadReferences() {
		if (!fs.existsSync(this._referencesPathAndFilename)) {
			return false;
		}

		try {
			const referencesObj = JSON.parse(fs.readFileSync(this._referencesPathAndFilename));
			this._references = new Map();
			Object.keys(referencesObj).forEach(pathAndFilename => {
				this._references.set(pathAndFilename, referencesObj[pathAndFilename]);
			});
			return true;
		} catch (e) {
			return false;
		}
	}

	/**
	 * Writes the references to file
	 */
	writeReferences() {
		let referencesObj = {};
		this._references.forEach((fileInfo, pathAndFilename) => {
			referencesObj[pathAndFilename] = fileInfo;
		});
		const referencesJson = JSON.stringify(referencesObj);
		fs.ensureDirSync(path.dirname(this._referencesPathAndFilename));
		fs.writeFileSync(this._referencesPathAndFilename, referencesJson);
	}

	/**
	 * Scans a file for any requires to Java types and records them in the internal
	 * references map.
	 *
	 * @param {String} pathAndFilename Full path to the file to scan
	 * @return {Boolean} True if the file contains requires to native types, false if not
	 */
	scanFileForHyperloopRequires(pathAndFilename) {
		const result = this.extractAndReplaceHyperloopRequires(pathAndFilename);
		if (result && result.usedClasses.length > 0) {
			this._references.set(pathAndFilename, {
				usedClasses: result.usedClasses,
				replacedContent: result.replacedContent
			});
			return true;
		}

		return false;
	}

	/**
	 * Extracts the name of all used native types and replaces the requires to them
	 * with the actual Hyperloop wrapper that represents that native type.
	 *
	 * @param {String} file Full path to the file to process
	 * @return {Object} Object containing any found classes and the replaced file content
	 */
	extractAndReplaceHyperloopRequires(file) {
		if (!fs.existsSync(file)) {
			return null;
		}

		let originalSource = fs.readFileSync(file, 'UTF-8');
		let modifiedSource = originalSource;
		let usedClasses = [];
		const requireRegex = /require\s*\(\s*[\\"']+([\w_/-\\.\\*]+)[\\"']+\s*\)/ig;
		this._logger.trace('Searching for hyperloop requires in: ' + file);
		let requireMatch;
		while ((requireMatch = requireRegex.exec(originalSource)) !== null) {
			let requireStatement = requireMatch[0];
			let className = requireMatch[1];

			// Is this a Java type we found in the JARs/APIs?
			this._logger.trace('Checking require for: ' + className);

			// Look for requires using wildcard package names and assume all types under that namespace!
			if (className.indexOf('.*') === className.length - 2) {
				const packageRegexp = new RegExp('^' + className.replace('.', '\\.').replace('*', '[A-Z]+[a-zA-Z0-9]+') + '$'); // eslint-disable-line security/detect-non-literal-regexp
				let validPackage = false;
				// Check that it's a valid package name and search for all the classes directly under that package!
				for (let mClass in this.metabase.classes) {
					if (mClass.match(packageRegexp)) {
						usedClasses.push(mClass);
						validPackage = true;
					}
				}
				if (validPackage) {
					const ref = 'hyperloop/' + className.slice(0, className.length - 2); // drop the .* ending
					let str = 'require(\'' + ref + '\')';
					modifiedSource = this.replaceAll(modifiedSource, requireStatement, str);
				}
			} else {
				// single type
				let lastIndex;
				let type = this.metabase.classes[className];
				if (!type) {
					// fallback for using dot notation to refer to nested class
					lastIndex = className.lastIndexOf('.');
					className = className.slice(0, lastIndex) + '$' + className.slice(lastIndex + 1);
					type = this.metabase.classes[className];
					if (!type) {
						continue;
					}
				}
				// Looks like it's a Java type, so let's hack it and add it to our list!
				// replace the require to point to our generated file path
				const ref = 'hyperloop/' + className;
				let str = 'require(\'' + ref + '\')';
				modifiedSource = this.replaceAll(modifiedSource, requireStatement, str);
				usedClasses.push(className);
			}
		}

		return {
			usedClasses: usedClasses,
			replacedContent: modifiedSource
		};
	}

	/**
	 * Replaces all occurrences of needle in haystack
	 *
	 * @param {String} haystack The string to search in
	 * @param {String} needle String that should be replaced
	 * @param {String} replaceStr String used to replace all occurrences of needle
	 * @return {String} New string which has all occurrences of needle replaced
	 */
	replaceAll(haystack, needle, replaceStr) {
		const length = needle.length;
		let newBuffer = haystack;
		let index = -1;

		while ((index = newBuffer.indexOf(needle)) >= 0) {
			const before = newBuffer.substring(0, index);
			const after = newBuffer.substring(index + length);
			newBuffer = before + replaceStr + after;
		}

		return newBuffer;
	}

}

module.exports = ScanReferencesTask;

'use strict';

const fs =  require('fs-extra');
const IncrementalFileTask = require('appc-tasks').IncrementalFileTask;
const path = require('path');
const babelParser = require('@babel/parser');
const t = require('@babel/types');
const generate = require('@babel/generator').default;
const traverse = require('@babel/traverse').default;

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
		return [this.outputDirectory];
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
				usedClasses: result.usedClasses
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

		const originalSource = fs.readFileSync(file, 'UTF-8');
		let usedClasses = [];

		// For typical require calls:
		// Look for CallExpression with callee Identifier whose name property is "require"
		//
		// For imports like this: import { AlertDialog, Builder, Activity } from 'android.app.*';
		// Look for ImportDeclaration whose 'source' property is a Literal with 'value' property holds the package name ('android.app.*')
		// 'specifiers' property is an array holding multiple elements of type ImportSpecifier
		// Each has an 'imported' and 'local' property is an Identifier whose 'name' is the imported class name ("AlertDialog", "Builder", "Activity")
		// Variant on this may be: import { AlertDialog as MyLocalName } where 'imported' would be 'AlertDialog', 'local' would be 'MyLocalName'
		//
		// import * as OnClickListener from "android.content.DialogInterface.OnClickListener";
		// Look for ImportDeclaration whose 'source' property is a Literal with 'value' property holds the full class name ("android.content.DialogInterface.OnClickListener")
		// specifiers property is an array holding one element: an ImportNamespaceSpecifier whose 'local' property is an Identifier whose 'name' is the import class name ("OnClickListener")
		//
		// import OnClickListener from "android.content.DialogInterface.OnClickListener";
		// Look for ImportDeclaration whose 'source' property is a Literal with value property holds the full class name ("android.content.DialogInterface.OnClickListener")
		// specifiers property is an array holding one element: an ImportDefaultSpecifier whose 'local' property is an Identifier whose 'name' is the import class name ("OnClickListener")
		//
		// import 'module-name';
		// This can be ignored in our case as nothing is imported locally, so basically it's like a require with no assign, imported only for running/side-effects.

		const classOrPackageRegexp = /[\w_/-\\.\\*]+/ig;
		this._logger.trace('Searching for hyperloop requires in: ' + file);
		const logger = this.logger;
		const self = this;
		let changedAST = false;
		const HyperloopVisitor = {
			// ES5-style require calls
			CallExpression: function(p) {
				const theString = p.node.arguments[0];
				let requireMatch;
				if (p.get('callee').isIdentifier({name: 'require'}) && // Is this a require call?
					theString && t.isStringLiteral(theString) &&     // Is the 1st param a literal string?
					(requireMatch = theString.value.match(classOrPackageRegexp)) !== null // Is it a hyperloop require?
				) {
					// Found a valid require...
					const className = requireMatch[0];

					// Is this a Java type we found in the JARs/APIs?
					logger.trace('Checking require for: ' + className);

					// Look for requires using wildcard package names and assume all types under that namespace!
					if (className.indexOf('.*') == className.length - 2) {
						const used = self.detectUsedClasses(className);
						if (used.length > 0) {
							usedClasses = usedClasses.concat(used); // add to our full listing
						}
					} else {
						// single type
						const validatedClassName = self.validateTypeName(className);
						if (validatedClassName) {
							// Looks like it's a Java type, so let's hack it and add it to our list!
							usedClasses.push(validatedClassName);
						}
					}
				}
			},
			// ES6+-style imports
			ImportDeclaration: function(p) {
				const theString = p.node.source;
				let requireMatch;
				if (theString && t.isStringLiteral(theString) &&   // module name is a string literal
					(requireMatch = theString.value.match(classOrPackageRegexp)) !== null // Is it a hyperloop require?
				) {
					// Found an import that acts the same as a require...
					const className = requireMatch[0];
					// Is this a Java type we found in the JARs/APIs?
					logger.trace('Checking require for: ' + className);

					// Look for requires using wildcard package names and assume all types under that namespace!
					if (className.indexOf('.*') == className.length - 2) {
						const used = self.detectUsedClasses(className); // TODO pass along the specifiers to narrow the used class listing!
						if (used.length > 0) {
							usedClasses = usedClasses.concat(used); // add to our full listing
						}
					} else {
						// single type
						const validatedClassName = self.validateTypeName(className);
						if (validatedClassName) { // FIXME: If name is invalid/can't be found, should we raise an error?
							usedClasses.push(validatedClassName);
						}
					}
				}
			}
		};

		// Now traverse the AST and generate modified source
		const ast = babelParser.parse(originalSource, { sourceFilename: file, sourceType: 'unambiguous' });
		traverse(ast, HyperloopVisitor);

		return {
			usedClasses: usedClasses,
		};
	}

	/**
	 * Given a java package import/require, returns the array of all types underneath that package.
	 * Returns empty array is there are no types (which means the package import is invalid).
	 * @param  {String} packageName The java package name
	 * @return {String[]}         Array of type names living under the package.
	 */
	detectUsedClasses(packageName) {
		const usedClasses = [];
		// Look for wildcard package names and assume all types under that namespace!
		const packageRegexp = new RegExp('^' + packageName.replace('.', '\\.').replace('*', '[A-Z]+[a-zA-Z0-9]+') + '$');
		// Search for all the classes directly under that package!
		for (let mClass in this.metabase.classes) {
			if (mClass.match(packageRegexp)) {
				usedClasses.push(mClass);
			}
		}

		return usedClasses;
	}

	/**
	 * Given a possible single type name, tries to look up the name used by hyperloop and return it.
	 * In most cases they're the same. If it's a nested class the name may change slightly.
	 * If the type can't be foudn in the metabase, we return null.
	 * @param  {String} className origin type name
	 * @return {String|null}      name used by hyperloop internally.
	 */
	validateTypeName(className) {
		// single type
		let type = this.metabase.classes[className];
		if (!type) {
			// fallback for using dot notation to refer to nested class
			const lastIndex = className.lastIndexOf('.');
			className = className.slice(0, lastIndex) + '$' + className.slice(lastIndex + 1);
			type = this.metabase.classes[className];
			if (!type) {
				return null;
			}
		}
		// Return valid type name
		return className;
	}

}

module.exports = ScanReferencesTask;

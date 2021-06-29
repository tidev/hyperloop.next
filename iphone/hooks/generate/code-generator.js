/* jshint node: true, esversion: 6 */

'use strict';

const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const util = require('./util');

/**
 * A generator for Hyperloop source code files
 */
class CodeGenerator {

	/**
	 * Constructs a new code generator
	 *
	 * @param {Object} sourceSet Set of source info objects passed to template files
	 * @param {Object} modules Map of module info objects
	 * @param {Object} iosBuilder iOS bulder instance
	 */
	constructor(sourceSet, modules, iosBuilder) {
		this.sourceSet = sourceSet;
		this.json = iosBuilder.metabase;
		this.state = iosBuilder.parserState;
		this.modules = modules;
		this.userRequires = iosBuilder.references;
		this.iosBuilder = iosBuilder;
	}

	/**
	 * Generates Hyperloop source files at the specified location
	 *
	 * @param {String} outputPath Path where to save source code files to
	 */
	generate(outputPath) {
		this.customClassMappings = [];

		this.mergeCustomClasses();
		// TODO: Only do this for production builds to support liveview
		this.sourceSet.classes = this.stripUnusedClasses();

		fs.ensureDirSync(outputPath);
		this.generateClasses(outputPath);
		this.generateStructs(outputPath);
		this.generateModules(outputPath);
		this.generateCustoms(outputPath);
		this.generateBootstrap(outputPath);
	}

	/**
	 * Merges custom classes source info into the native classes source info object
	 */
	mergeCustomClasses() {
		util.logger.trace('Merging dynamic custom classes into native class list');
		Object.keys(this.sourceSet.customs.classes).forEach((className) => {
			var customClassInfo = this.sourceSet.customs.classes[className];
			customClassInfo.custom = true;
			customClassInfo.name = customClassInfo.class.name;
			this.sourceSet.classes[className] = customClassInfo;
		});
	}

	/**
	 * Iterates over the source set and removes any classes that are not needed.
	 *
	 * Any classes that have no members AND are not used as a superclass will be
	 * removed from the set of used classes. As this can affect classes that are
	 * used as imports, those will be added to the set of used classes again.
	 *
	 * @return {Object} Class source set without unused classes.
	 */
	stripUnusedClasses() {
		util.logger.trace('Removing unused classes from code generation');
		var usedClasses = {};

		// Create map of classes used as superclass for faster lookups
		var superclassMap = {};
		Object.keys(this.sourceSet.classes).forEach((className) => {
			var classInfo = this.sourceSet.classes[className];
			if (classInfo.superclass) {
				superclassMap[classInfo.superclass.name] = 1;
			}
		});

		Object.keys(this.sourceSet.classes).forEach((className) => {
			var classInfo = this.sourceSet.classes[className];

			var classMemberLists = ['class_methods', 'class_properties', 'instance_methods', 'instance_properties'];
			var hasClassMembers = classMemberLists.some((memberListName) => {
				return classInfo.class[memberListName].length > 0;
			});
			var isSuperclass = classInfo.class.name in superclassMap;
			var isClassUsed = hasClassMembers || isSuperclass;

			var fqcn = classInfo.framework +  '/' + classInfo.class.name;
			var isExplicitlyRequired = Object.keys(this.userRequires).some((requirePath) => {
				return requirePath.indexOf(fqcn.toLowerCase()) !== -1;
			});

			if (isClassUsed || isExplicitlyRequired) {
				usedClasses[className] = this.sourceSet.classes[className];
			} else {
				util.logger.trace(chalk.gray('Excluding class ') + chalk.green(fqcn));
			}
		});

		var importReintegrationQueue = [];
		var enqueMissingImports = (classInfo) => {
			Object.keys(classInfo.imports).forEach((importName) => {
				var importInfo = classInfo.imports[importName];
				if (usedClasses[importInfo.name] || this.sourceSet.structs[importInfo.name]) {
					return;
				}
				if (importReintegrationQueue.indexOf(importInfo) === -1) {
					importReintegrationQueue.push(importInfo);
				}
			});
		};
		Object.keys(usedClasses).forEach((className) => {
			var classInfo = usedClasses[className];
			enqueMissingImports(classInfo);
		});
		while (importReintegrationQueue.length > 0) {
			var importInfo = importReintegrationQueue.pop();
			var classInfo = this.sourceSet.classes[importInfo.name];
			if (!classInfo) {
				// If the import is a struct we can just continue because we didn't touch those
				var structInfo = this.sourceSet.classes[importInfo.name];
				if (structInfo) {
					continue;
				}
				throw new Error(importInfo.name + ' not found!');
			}
			util.logger.trace(chalk.gray('Reintegrating previously excluded import ') + chalk.green(classInfo.class.name));
			usedClasses[importInfo.name] = classInfo;
			enqueMissingImports(classInfo);
		}

		return usedClasses;
	}

	/**
	 * Generates the source code files of Hyperloop JS wrappers for classes.
	 *
	 * @param {String} outputPath Path where to save source code files to
	 */
	generateClasses(outputPath) {
		util.logger.trace('Generating Hyperloop JS wrappers for native classes');
		Object.keys(this.sourceSet.classes).forEach((className) => {
			var classInfo = this.sourceSet.classes[className];
			var code = util.generateTemplate('class', {
				data: classInfo
			});
			var classMeta = classInfo.custom === true ? classInfo : this.json.classes[className];
			util.generateFile(outputPath, 'class', classMeta, code);
		});
	}

	/**
	 * Generates the source code files of Hyperloop JS wrappers for structs.
	 *
	 * @param {String} outputPath Path where to save source code files to
	 */
	generateStructs(outputPath) {
		util.logger.trace('Generating Hyperloop JS wrappers for native structs');
		Object.keys(this.sourceSet.structs).forEach((structName) => {
			var structInfo = this.sourceSet.structs[structName];
			var code = util.generateTemplate('struct', {
				data: structInfo
			});
			util.generateFile(outputPath, 'struct', this.json.structs[structName], code);
		});
	}

	/**
	 * Generates the source code files of Hyperloop JS wrappers and native helper
	 * code for modules.
	 *
	 * @param {String} outputPath Path where to save source code files to
	 */
	generateModules(outputPath) {
		util.logger.trace('Generating Hyperloop JS wrappers and native helpers for modules');
		Object.keys(this.sourceSet.modules).forEach((moduleName) => {
			var moduleInfo = this.modules[moduleName];
			var moduleSourceInfo = this.sourceSet.modules[moduleName];

			if (this.doesModuleNeedsNativeWrapper(moduleSourceInfo)) {
				this.convertToUmbrellaHeaderImports(moduleSourceInfo.frameworks);
				var nativeCode = util.generateTemplate('module.m', {
					data: moduleSourceInfo
				});
				util.generateFile(outputPath, moduleInfo.name, moduleInfo, nativeCode, '.m');
			}

			var jsCode = util.generateTemplate('module', {
				data: moduleSourceInfo
			});
			var classWithSameNameExists = this.json.classes[moduleInfo.name] ? true : false;
			if (classWithSameNameExists) {
				var classPathAndFilename = path.join(outputPath, moduleInfo.framework.toLowerCase(), moduleInfo.name.toLowerCase() + '.js');
				var classContent = '';
				if (fs.existsSync(classPathAndFilename)) {
					classContent = fs.readFileSync(classPathAndFilename);
				}
				classContent += jsCode;
				fs.writeFileSync(classPathAndFilename, classContent);
			} else {
				util.generateFile(outputPath, moduleInfo.name, moduleInfo, jsCode);
			}
		});
	}

	/**
	 * Generates the source code files of Hyperloop native helpers for custom classes
	 *
	 * @param {String} outputPath Path where to save source code files to
	 */
	generateCustoms(outputPath) {
		if (Object.keys(this.state.getClassNames()) === 0) {
			return;
		}

		this.fixCustomImports(this.state.imports);

		util.logger.trace('Generating Hyperloop native helpers for custom classes');
		var code = util.generateTemplate('custom.m', {
			data: {
				code: this.state.gencode.join('\n'),
				imports: this.state.imports,
				mappings: this.sourceSet.customs.mappings
			}
		});
		util.generateFile(outputPath, 'custom', {framework:'Hyperloop', name:'Custom'}, code, '.m');
	}

	/**
	 * Generate a hyperloop bootstrap script to be loaded on app startup, but before the "app.js" gets loaded.
	 * Provides JS require/import alias names matching native class names to their equivalent JS files.
	 * @param {String} outputPath Path of directory to write bootstrap file to.
	 */
	generateBootstrap(outputPath) {
		const fileLines = [];
		const fetchBindingsFrom = (sourceTypes) => {
			if (!sourceTypes) {
				return;
			}
			const isModule = (sourceTypes == this.sourceSet.modules);
			for (const typeName in sourceTypes) {
				const frameworkName = sourceTypes[typeName].framework;
				if (!frameworkName) {
					continue;
				}
				const requireName = `/hyperloop/${frameworkName.toLowerCase()}/${typeName.toLowerCase()}`;
				if (frameworkName !== typeName) {
					fileLines.push(`binding.redirect('${frameworkName}/${typeName}', '${requireName}');`);
				}
				if (isModule) {
					fileLines.push(`binding.redirect('${frameworkName}', '${requireName}');`);
				}
			}
		};
		fetchBindingsFrom(this.sourceSet.classes);
		fetchBindingsFrom(this.sourceSet.structs);
		fetchBindingsFrom(this.sourceSet.modules);

		const filePath = path.join(outputPath, 'hyperloop.bindings.js');
		fs.writeFileSync(filePath, fileLines.join('\n') + '\n');
	}

	/**
	 * Checks if a module needs a native wrapper file generated.
	 *
	 * @param {Object} moduleInfo
	 * @return {Boolean} True if the native wrapper should be generated, false if not
	 */
	doesModuleNeedsNativeWrapper(moduleInfo) {
		return moduleInfo.class.properties.length ||
			moduleInfo.class.class_methods.length ||
			moduleInfo.class.obj_class_method.length ||
			Object.keys(moduleInfo.class.static_variables).length ||
			moduleInfo.class.blocks.length;
	}

	/**
	 * Fixes custom module imports to use the correct framework header.
	 *
	 * Prior to dynamic framework support framework includes were simply genrated
	 * by assuming their umbrella header name. Dynamic frameworks that are written
	 * in Swift provide an ObjC interface header which requires a different header
	 * resolution. It is easier to fix this here afterwards than to do it in the
	 * actual custom module generation.
	 *
	 * @param {Object} imports Imports map
	 */
	fixCustomImports(imports) {
		Object.keys(imports).forEach(header => {
			const headerParts = header.split('/');
			const frameworkName = headerParts[0];
			const headerFilename = headerParts[1];
			if (!this.iosBuilder.frameworks.has(frameworkName)) {
				return;
			}

			const umbrellaHeader = this.iosBuilder.frameworks.get(frameworkName).umbrellaHeader;
			if (umbrellaHeader === null) {
				return;
			}

			const umbrellaHeaderBasename = path.basename(umbrellaHeader, '.h');
			if (umbrellaHeaderBasename !== headerFilename) {
				const newHeader = `${frameworkName}/${umbrellaHeaderBasename}`;
				imports[newHeader] = 1;
				delete imports[header];
			}
		});
	}

	/**
	 * Takes a map of used framework names and converts it to their correct umbrella
	 * header imports.
	 *
	 * Prior to this we would simply assume umbrella headers as Framework/Framework.h,
	 * which is a best practive though, but not every framework sticks to this.
	 *
	 * Utilizes the frameworks metadata to read the umbrella header from a framework's
	 * module map or falls back to the old naming scheme.
	 *
	 * @param {Object} frameworks Object map of used frameworks as keys
	 */
	convertToUmbrellaHeaderImports(frameworks) {
		Object.keys(frameworks).forEach(frameworkName => {
			if (this.iosBuilder.frameworks.has(frameworkName)) {
				const meta = this.iosBuilder.frameworks.get(frameworkName);
				let frameworkUmbrellaHeaderImport = `${meta.name}/${meta.name}.h`;
				if (meta.umbrellaHeader) {
					frameworkUmbrellaHeaderImport = `${meta.name}/${path.basename(meta.umbrellaHeader)}`;
				}
				delete frameworks[frameworkName];
				frameworks[frameworkUmbrellaHeaderImport] = 1;
			}
		});
	}
}

module.exports = CodeGenerator;

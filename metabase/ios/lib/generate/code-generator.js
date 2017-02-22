/* jshint node: true, esversion: 6 */

'use strict';

var chalk = require('chalk');
var fs = require('fs');
var path = require('path');
var util = require('./util');

/**
 * A generator for Hyperloop source code files
 */
class CodeGenerator {

  /**
   * Constructs a new code generator
   *
   * @param {Object} sourceSet Set of source info objects passed to template files
   * @param {Object} json Metabase object
   * @param {Object} state State from the metabase parser
   * @param {Object} modules Map of module info objects
   */
  constructor(sourceSet, json, state, modules) {
    this.sourceSet = sourceSet;
    this.json = json;
    this.state = state;
    this.modules = modules;
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

    this.generateClasses(outputPath);
    this.generateStructs(outputPath);
    this.generateModules(outputPath);
    this.generateCustoms(outputPath);
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
      if (isClassUsed) {
        usedClasses[className] = this.sourceSet.classes[className];
      } else {
        var fqcn = classInfo.framework +  '/' + classInfo.class.name;
        util.logger.trace(chalk.gray('exlcuding class ') + chalk.green(fqcn));
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
      util.logger.trace(chalk.gray('adding missing import ') + chalk.green(classInfo.class.name));
      usedClasses[importInfo.name] = classInfo;
      enqueMissingImports(classInfo);
    }

    return usedClasses;
  }

  /**
   * Generates the source code files of Hyperloop JS proxies for classes.
   *
   * @param {String} outputPath Path where to save source code files to
   */
  generateClasses(outputPath) {
    util.logger.trace('Generating Hyperloop JS proxies for native classes');
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
   * Generates the source code files of Hyperloop JS proxies for structs.
   *
   * @param {String} outputPath Path where to save source code files to
   */
  generateStructs(outputPath) {
    util.logger.trace('Generating Hyperloop JS proxies for native structs');
    Object.keys(this.sourceSet.structs).forEach((structName) => {
      var structInfo = this.sourceSet.structs[structName];
      var code = util.generateTemplate('struct', {
    		data: structInfo
    	});
    	util.generateFile(outputPath, structInfo.name, this.json.structs[structName], code);
    });
  }

  /**
   * Generates the source code files of Hyperloop JS proxies and native heloper
   * code for modules.
   *
   * @param {String} outputPath Path where to save source code files to
   */
  generateModules(outputPath) {
    util.logger.trace('Generating Hyperloop JS proxies and native helpers for modules');
    Object.keys(this.sourceSet.modules).forEach((moduleName) => {
      var moduleInfo = this.modules[moduleName];
      var moduleSourceInfo = this.sourceSet.modules[moduleName];

      if (this.doesModuleNeedsNativeWrapper(moduleSourceInfo)) {
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
    		var classPathAndFilename = path.join(outputPath, moduleInfo.framework, moduleInfo.name + '.js');
    		var classContent = fs.readFileSync(classPathAndFilename);
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
}

module.exports = CodeGenerator;

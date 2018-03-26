'use strict';

const path = require('path');

const chalk = require('chalk'); // eslint-disable-line no-unused-vars
const fs = require('fs-extra');

const metabasegen = require('./metabase');
const Frameworks = require('./frameworks').Frameworks;
const ModuleMetadata = require('./module_metadata').ModuleMetadata;
const getAllHeaderFiles = require('./module_metadata').getAllHeaderFiles;
const resourcesLib = require('./resources');
const SwiftModule = require('./swift').SwiftModule;

const SWIFT_REGEXP = /\.swift$/;

class ThirdPartyFramework extends ModuleMetadata {
	/**
	 * @param {string} name name to use for the framework
	 * @param {string[]} headers header folder(s)
	 * @param {string[]} resources resource folder(s)
	 * @param {string[]} swiftSources swift source files
	 */
	constructor(name, headers, resources, swiftSources) {
		super(name, (headers || resources)[0], ModuleMetadata.MODULE_TYPE_DYNAMIC);
		this.headers = headers;
		this.resources = resources;
		this.usesSwift = swiftSources.length > 0;
		if (this.usesSwift) {
			this.swiftModule = new SwiftModule(name, swiftSources);
		}
	}

	/**
	 * Iterates over a framework's Headers directory and any nested frameworks to
	 * collect the paths to all available header files of a framework.
	 *
	 * @return {string[]} List with paths to all found header files
	 */
	getHeaders() {
		if (this.allHeaders) {
			return this.allHeaders;
		}
		// lazily calulate
		this.allHeaders = [];
		// FIXME: Note this is basically duplicated logic from super class
		this.headers.forEach(header => {
			const stats = fs.statSync(header);
			if (stats.isFile()) { // umbrella header file
				this.allHeaders.push(header);
			} else if (stats.isDirectory()) { // umbrella header directory
				this.allHeaders = this.allHeaders.concat(getAllHeaderFiles([ header ]));
			}
		});
		return this.allHeaders;
	}

	/**
	 * [compileResources description]
	 * @param {string} xcodeTargetOS 'iphoneos' || 'iphonesimulator'
	 * @param {string} iosSdkVersion i.e. '9.0'
	 * @param {string} xcodeAppDir target directory
	 * @return {Promise} [description]
	 */
	compileResources(xcodeTargetOS, iosSdkVersion, xcodeAppDir) {
		if (!this.resources) {
			return Promise.resolve();
		}
		const sdk = xcodeTargetOS + iosSdkVersion;
		return Promise.all(this.resources.map(resource => resourcesLib.compileResources(resource, sdk, xcodeAppDir, true)));
	}

	/**
	 * Returns the shallow set of all dependencies (the names of the frameworks)
	 * @param  {SDKEnvironment} sdk The SDk information used to generate the metabase
	 * @return {Promise<Set<string>>}
	 */
	getDependencies(sdk) {
		if (this.swiftModule) {
			return Promise.all([
				this.swiftModule.getDependencies(sdk),
				super.getDependencies(sdk)
			])
				.then(dependencySets => {
					return Promise.resolve(new Set([ ...dependencySets[0], ...dependencySets[1] ]));
				});
		}
		return super.getDependencies(sdk);
	}

	/**
	 * Returns the metabase JSON object. May be from in-memory cache, on-disk cache, or generated on-demand.
	 * @param  {SDKEnvironment} sdk The SDk information used to generate the metabase
	 * @return {Promise<object>}
	 */
	generateMetabase(sdk) {
		if (this.swiftModule) {
			return Promise.all([
				this.swiftModule.generateMetabase(sdk),
				super.generateMetabase(sdk)
			])
				.then(metabases => {
					// Combine the two!
					return Promise.resolve(metabasegen.merge(metabases[0], metabases[1]));
				});
		}
		return super.generateMetabase(sdk);
	}
}

class ThirdPartyFrameworks extends Frameworks {
	/**
	 * [constructor description]
	 * @param {string} projectDir project Directory to use as base dir for relative paths
	 * @param {object} thirdparty Keys are framework names, values are an object holding patsh to source/header/resource directories
	 */
	constructor(projectDir, thirdparty) {
		super();
		this.projectDir = projectDir;
		this.thirdparty = thirdparty;
	}

	/**
	 * Attempts to load the modules. May be cached in-memory, on-disk or may need to be calculated on-demand
	 * @return {Promise<Map<string, ModuleMetadata>>}
	 */
	load() {
		// do we have it in memory?
		if (this.modules) {
			return Promise.resolve(this.modules);
		}

		// Not in-memory. Do the real work.
		return this.detect().then(modules => {
			// then store in memory
			this.modules = modules;
			return Promise.resolve(modules);
		});
	}

	/**
	 * The actual work to detect/load frameworks from original data.
	 * @return {Promise<Map<string, ModuleMetadata>>}
	 */
	detect() {
		const frameworkNames = Object.keys(this.thirdparty);

		const promises = frameworkNames.map(frameworkName => {
			return new Promise(resolve => {
				const lib = this.thirdparty[frameworkName];
				const headers = arrayifyAndResolve(this.projectDir, lib.header);
				const resources = arrayifyAndResolve(this.projectDir, lib.resource);
				const sources = arrayifyAndResolve(this.projectDir, lib.source);
				const swiftSources = [];
				sources && sources.forEach(dir => {
					fs.readdirSync(dir).forEach(filename => {
						if (SWIFT_REGEXP.test(filename)) {
							swiftSources.push(path.join(dir, filename));
						}
					});
				});
				resolve(new ThirdPartyFramework(frameworkName, headers, resources, swiftSources));
			});
		});
		return Promise.all(promises)
			.then(frameworks => {
				const modules = new Map();
				frameworks.forEach(f => modules.set(f.name, f));
				return Promise.resolve(modules);
			});
	}
}

function getThirdPartyFrameworks(projectDir, thirdparty) {
	return new ThirdPartyFrameworks(projectDir, thirdparty).load();
}

/**
 * [arrayifyAndResolve description]
 * @param  {string} projectDir base dir
 * @param  {string|string[]} it         [description]
 * @return {string[]}
 */
function arrayifyAndResolve(projectDir, it) {
	if (it) {
		const asArray = Array.isArray(it) ? it : [ it ];
		return asArray.map(name => path.resolve(projectDir, name));
	}
	return null;
}

exports.getThirdPartyFrameworks = getThirdPartyFrameworks;

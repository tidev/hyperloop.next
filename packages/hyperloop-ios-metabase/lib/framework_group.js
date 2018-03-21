// // TODO: We should encapsulate the idea of a Set of frameworks as a group:
// // user, cocoapods, system, 3rd-party
// // For each group we can add generic methods about reading/writing to cache
// // Cache location is based on group type.
// // - System should be cached in ~/.USER_HOME_HYPERLOOP
// // - Others likely under the project build dir?
// 'use strict';
//
// class FrameworkGroup {
//
// 	/**
// 	 * Constructs a new grouping of frameworks
// 	 *
// 	 * @param {String} type Module type, one of the MODULE_TYPE_* constants
// 	 * @param {Map<string, ModuleMetadata>} frameworks frameworks to wrap
// 	 */
// 	constructor(type, frameworks) {
// 		// TODO Take in cache file path
// 		this.type = type;
// 		this.frameworks = frameworks;
// 	}
//
// 	writeToCache() {
// 		writeModulesMetadataToCache(this.modules, this.cacheFile());
// 	}
//
// 	readFromCache() {
// 		this.modules = readModulesMetadataFromCache(this.cacheFile());
// 	}
//
// 	static systemFrameworks(sdkPath) {
// 		// TODO: Generate cache file path from sdk path
// 		// Read from cache if exists and wrap
// 		// otherwise detect frameworks and then write to cache for next time!
// 	}
//
// 	static userFrameworks(userFrameworks) {
// 		// TODO: Generate cache file path from user framework names? (cache dir can be tmp)
// 		// Read from cache if exists and wrap
// 		// otherwise wrap in ModuleMetadatas and then write to cache for next time!
// 	}
//
// 	static cocoapodsFrameworks(builder) {
//
// 	}
// }
//
// exports.FrameworkGroup = FrameworkGroup;

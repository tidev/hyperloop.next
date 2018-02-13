/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015-2018 by Appcelerator, Inc.
 */
'use strict';

var spawn = require('child_process').spawn,
	exec = require('child_process').exec,
	path = require('path'),
	fs = require('fs-extra'),
	async = require('async'),
	semver = require('semver'),
	crypto = require('crypto'),
	chalk = require('chalk'),
	util = require('./util'),
	swiftlilb = require('./swift'),
	binary = path.join(__dirname, '..', 'bin', 'metabase');

/**
 * return the configured SDK path
 */
function getSDKPath(sdkType, callback) {
	exec('/usr/bin/xcrun --sdk ' + sdkType + ' --show-sdk-path', function (err, stdout) {
		if (err) { return callback(err); }
		return callback(null, stdout.trim());
	});
}

/**
 * convert an apple style version (9.0) to a semver compatible version
 */
function appleVersionToSemver(ver) {
	var v = String(ver).split('.');
	if (v.length === 1) {
		return ver + '.0.0';
	}
	if (v.length === 2) {
		return ver + '.0';
	}
	return ver;
}

/**
 * Creates a MD5 hash from the given string data.
 *
 * @param {String} data Data the hash will be generated for
 * @return {String} The generated MD5 hash
 */
function createHashFromString (data) {
	return crypto.createHash('md5').update(data).digest('hex');
}

var implRE = /@interface\s*(.*)/g,
	swiftClassRE = /class\s*(\w+)/g;

function extractImplementations (fn, files) {
	util.logger.trace('Extracting implementations from ' + fn.cyan);
	var content = fs.readFileSync(fn).toString();
	var matches;
	if (/\.swift$/.test(fn)) {
		matches = content.match(swiftClassRE);
		if (matches && matches.length) {
			matches.forEach(function (match) {
				var m = swiftClassRE.exec(match);
				if (m && m.length) {
					files[m[1]] = fn;
				}
			});
		}
	} else {
		matches = content.match(implRE);
		var found = 0;
		if (matches && matches.length) {
			matches.forEach(function (match) {
				// skip categories
				var p = match.indexOf('(');
				if (p < 0) {
					var m = match.substring(11);
					var i = m.indexOf(':');
					// make sure this is an actual declaration (vs. comment);
					if (i > 0) {
						m = m.substring(0, i).trim();
						// trim off any qualifiers such as
						// @interface NSSet<__covariant ObjectType>
						i = m.indexOf('<');
						if (i > 0) {
							m = m.substring(0, i).trim();
						}
						files[m] = fn;
						found++;
					}
				} else {
					var name = match.substring(11, p).trim();
					if (!(name in files)) {
						files[name] = fn;
						found++;
					}
				}
			});
		}
		if (!found) {
			// convention for user-generated files like Foo+Bar.h where Bar is a
			// category of Foo, we exclude those
			if (fn.indexOf('+') < 0) {
				files[path.basename(fn).replace('.h', '').trim()] = fn;
			}
		}
	}
}

/**
 * Represents a module, which can be either a static library or a framework.
 */
class ModuleMetadata {

	/**
	 * Constructs a new module metadata object
	 *
	 * @param {String} name Module name
	 * @param {String} path Full path to the module
	 * @param {String} type Module type, one of the MODULE_TYPE_* constants
	 */
	constructor(name, path, type) {
		this.name = name;
		this.path = path;
		this.type = type;
		this.isFramework = this.path.endsWith('.framework');
		this.introducedIn = null;
		this.umbrellaHeader = null;
		this.usesSwift = false;
		this.typeMap = {};
	}

	/**
	 * Constant for a static module type
	 * @type {String}
	 */
	static get MODULE_TYPE_STATIC() {
		return 'static';
	}

	/**
	 * Constant for a dynamic module type
	 * @type {String}
	 */
	static get MODULE_TYPE_DYNAMIC() {
		return 'dynamic';
	}

	/**
	 * Determines wether this module is available in the given iOS version
	 *
	 * @param {String} iOSVersion iOS version identifier to check the availability for
	 * @return {Boolean} True if this module is available in the given iOS version, false if not
	 */
	isAvailable(iOSVersion) {
		if (semver.valid(this.introducedIn) === null) {
			return true;
		}

		return semver.lte(this.introducedIn, appleVersionToSemver(iOSVersion));
	}

	/**
	 * Returns a serializable object representation of this module.
	 *
	 * @return {Object} Plain object representation of this class
	 */
	toJson() {
		return {
			name: this.name,
			path: this.path,
			type: this.type,
			introducedIn: this.introducedIn,
			umbrellaHeader: this.umbrellaHeader,
			usesSwift: this.usesSwift,
			typeMap: this.typeMap
		};
	}

	/**
	 * Prases a plain object received from JSON data and converts it back to a
	 * module metadata instance.
	 *
	 * @param {Object} json Object containing data from JSON
	 * @return {ModuleMetadata} The created module metadata instance
	 */
	static fromJson(json) {
		const metadata = new ModuleMetadata(json.name, json.path, json.type);
		metadata.introducedIn = json.introducedIn;
		metadata.umbrellaHeader = json.umbrellaHeader;
		metadata.usesSwift = json.usesSwift;
		metadata.typeMap = json.typeMap;
		return metadata;
	}

}

/**
 * generate system framework includes mapping
 */
function generateSystemFrameworks(sdkPath, iosMinVersion, callback) {
	const frameworksPath = path.resolve(path.join(sdkPath, 'System/Library/Frameworks'));
	const frameworksEntries = fs.readdirSync(frameworksPath).filter(entryName => /\.framework$/.test(entryName));
	const frameworks = new Map();
	iosMinVersion = appleVersionToSemver(iosMinVersion);

	async.each(frameworksEntries, function (frameworkPackageName, next) {
		const frameworkName = frameworkPackageName.replace('.framework', '');
		const frameworkPath = path.join(frameworksPath, frameworkPackageName);
		const frameworkHeadersPath = path.join(frameworkPath, 'Headers');
		const frameworkUmbrellaHeader = path.join(frameworkHeadersPath, `${frameworkName}.h`);
		if (fs.existsSync(frameworkUmbrellaHeader)) {
			const frameworkMetadata = new ModuleMetadata(frameworkName, frameworkPath, ModuleMetadata.MODULE_TYPE_DYNAMIC);
			frameworkMetadata.umbrellaHeader = frameworkUmbrellaHeader;

			var mapping = {};
			extractImplementationsFromFramework(frameworkName, frameworkPath, mapping);
			frameworkMetadata.typeMap = mapping[frameworkName];
			frameworks.set(frameworkName, frameworkMetadata);

			next();
		} else {
			return next();
		}
	}, function (err) {
		return callback(err, frameworks);
	});
}

/**
 * Extracts Objective-C interface implementations from all available header
 * files inside the given framework.
 *
 * This will include implementations from nested sub-frameworks that will be
 * mapped to the parent framework.
 *
 * @param {String} frameworkName Name of the framework
 * @param {String} frameworkPath Full path to the framwork
 * @param {Object} includes Object with all include mappings
 */
function extractImplementationsFromFramework(frameworkName, frameworkPath, includes) {
	var implementationToHeaderFileMap = includes[frameworkName] || {};
	var headerFiles = collectFrameworkHeaders(frameworkPath);
	headerFiles.forEach(function (headerFile) {
		extractImplementations(headerFile, implementationToHeaderFileMap);
	});
	includes[frameworkName] = implementationToHeaderFileMap;
}

/**
 * Iterates over a framework's Headers directory and any nested frameworks to
 * collect the paths to all available header files of a framework.
 *
 * @param {String} frameworkPath Full path to the framwork
 * @return {Array} List with paths to all found header files
 */
function collectFrameworkHeaders(frameworkPath) {
	var frameworkHeadersPath = path.join(frameworkPath, 'Headers');

	// Skip frameworks that do not have public headers set (like FirebaseNanoPB)
	if (!fs.existsSync(frameworkHeadersPath)) {
		return [];
	}

	var headerFiles = getAllHeaderFiles([ frameworkHeadersPath ]);
	var nestedFrameworksPath = path.join(frameworkPath, 'Frameworks');
	if (fs.existsSync(nestedFrameworksPath)) {
		fs.readdirSync(nestedFrameworksPath).forEach(function (subFrameworkEntry) {
			var nestedFrameworkPath = path.join(nestedFrameworksPath, subFrameworkEntry);
			headerFiles = headerFiles.concat(collectFrameworkHeaders(nestedFrameworkPath));
		});
	}

	return headerFiles;
}

/**
 * generate a metabase
 *
 * @param {String} buildDir cache directory to write the files
 * @param {String} sdk the sdk type such as iphonesimulator
 * @param {String} sdk path the path to the SDK
 * @param {String} iosMinVersion the min version such as 9.0
 * @param {Array} includes array of header paths (should be absolute paths)
 * @param {Boolean} excludeSystem if true, will exclude any system libraries in the generated output
 * @param {Function} callback function to receive the result which will be (err, json, json_file, header_file)
 * @param {Boolean} force if true, will not use cache
 * @param {Array} extraHeaders Array of extra header search paths passed to the metabase parser
 * @param {Array} extraFrameworks Array of extra framework search paths passed to the metabase parser
 */
function generateMetabase(buildDir, sdk, sdkPath, iosMinVersion, includes, excludeSystem, callback, force, extraHeaders, extraFrameworks) {
	var cacheToken = createHashFromString(sdkPath + iosMinVersion + excludeSystem + JSON.stringify(includes));
	var header = path.join(buildDir, 'metabase-' + iosMinVersion + '-' + sdk + '-' + cacheToken + '.h');
	var outfile = path.join(buildDir, 'metabase-' + iosMinVersion + '-' + sdk + '-' + cacheToken + '.json');

	// Foundation header always needs to be included
	var absoluteFoundationHeaderRegex = /Foundation\.framework\/Headers\/Foundation\.h$/;
	var systemFoundationHeaderRegex = /^[<"]Foundation\/Foundation\.h[>"]$/;
	var isFoundationIncluded = includes.some(function (header) {
		return systemFoundationHeaderRegex.test(header) || absoluteFoundationHeaderRegex.test(header);
	});
	if (!isFoundationIncluded) {
		includes.unshift(path.join(sdkPath, 'System/Library/Frameworks/Foundation.framework/Headers/Foundation.h'));
	}

	// check for cached version and attempt to return if found
	if (!force && fs.existsSync(header) && fs.existsSync(outfile)) {
		try {
			var json = JSON.parse(fs.readFileSync(outfile));
			json.$includes = includes;
			return callback(null, json, path.resolve(outfile), path.resolve(header), true);
		} catch (e) {
			// fall through and re-generate again
		}
	}

	force && util.logger.trace('forcing generation of metabase to', outfile);

	var contents =  '/**\n'
					+ ' * HYPERLOOP GENERATED - DO NOT MODIFY\n'
					+ ' */\n'
					+ includes.map(function (fn) {
						if (fn) {
							if (fn.charAt(0) === '<') {
								return '#import ' + fn;
							} else {
								return '#import "' + fn + '"';
							}
						}
					}).join('\n')
					+ '\n';
	fs.writeFileSync(header, contents);
	var args = [
		'-i', path.resolve(header),
		'-o', path.resolve(outfile),
		'-sim-sdk-path', sdkPath,
		'-min-ios-ver', iosMinVersion,
		'-pretty'
	];
	if (excludeSystem) {
		args.push('-x');
	}
	if (extraHeaders && extraHeaders.length > 0) {
		args.push('-hsp');
		args.push('"' + extraHeaders.join(',') + '"');
	}
	if (extraFrameworks && extraFrameworks.length > 0) {
		args.push('-fsp');
		args.push('"' + extraFrameworks.join(',') + '"');
	}
	util.logger.trace('running', binary, 'with', args.join(' '));
	var ts = Date.now();
	var triedToFixPermissions = false;
	(function runMetabase(binary, args) {
		try {
			var child = spawn(binary, args);
		} catch (e) {
			if (e.code === 'EACCES') {
				if (!triedToFixPermissions) {
					fs.chmodSync(binary, '755');
					triedToFixPermissions = true;
					return runMetabase(binary, args);
				} else {
					return callback(new Error('Incorrect permissions for metabase binary ' + binary + '. Could not fix permissions automatically, please make sure it has execute permissions by running: chmod +x ' + binary));
				}
			}

			throw e;
		}
		child.stdout.on('data', function (buf) {
			util.logger.debug(String(buf).replace(/\n$/, ''));
		});
		child.stderr.on('data', function (buf) {
			// Without this, for whatever reason, the metabase parser never returns
		});
		child.on('error', callback);
		child.on('exit', function (ex) {
			util.logger.trace('metabase took', (Date.now() - ts), 'ms to generate');
			if (ex) {
				return callback(new Error('Metabase generation failed'));
			}
			var json = JSON.parse(fs.readFileSync(outfile));
			json.$includes = includes;
			return callback(null, json, path.resolve(outfile), path.resolve(header), false);
		});
	}(binary, args));
}

/**
 * return the system frameworks mappings as JSON for a given sdkType and minVersion
 */
function getSystemFrameworks(cacheDir, sdkType, minVersion, callback) {
	var fn = 'metabase-mappings-' + sdkType + '-' + minVersion + '.json';
	if (!fs.existsSync(cacheDir)) {
		fs.mkdirSync(cacheDir);
	}
	var cacheFilename = path.join(cacheDir, fn);
	var cachedMetadata = readModulesMetadataFromCache(cacheFilename);
	if (cachedMetadata !== null) {
		return callback(null, cachedMetadata);
	}

	getSDKPath(sdkType, function (err, sdkPath) {
		if (err) {
			return callback(err);
		}
		generateSystemFrameworks(sdkPath, minVersion, function (err, frameworks) {
			if (err) {
				return callback(err);
			}
			frameworks.set('$metadata', {
				sdkType: sdkType,
				minVersion: minVersion,
				sdkPath: sdkPath
			});
			writeModulesMetadataToCache(frameworks, cacheFilename);
			callback(null, frameworks);
		});
	});
}

function recursiveReadDir(dir, result) {
	result = result || [];
	var files = fs.readdirSync(dir);
	files.forEach(function (fn) {
		var fp = path.join(dir, fn);
		if (fs.statSync(fp).isDirectory()) {
			recursiveReadDir(fp, result);
		} else {
			result.push(fp);
		}
	});
	return result;
}

/**
 * for an array of directories, return all validate header files
 */
function getAllHeaderFiles(directories) {
	var files = [];
	directories.forEach(function (dir) {
		recursiveReadDir(dir).forEach(function (fn) {
			if (/\.(h(pp)?|swift)$/.test(fn)) {
				files.push(fn);
			}
		});
	});
	return files;
}

/**
 * Processes all header files under the given directories and creates a mapping
 * of all implemented classes and their header file.
 *
 * Used for custom user source code configured via the hyperloop.ios.thirdparty
 * setting in appc.js. Both Objective-C and Swift code is supported.
 *
 * @param {String} cacheDir Full path to the cache directory
 * @param {Array} directories Array of directories to scan for header files
 * @param {Function} callback Callback function
 * @param {String} frameworkName Name of the framework the scanned headers belong to
 */
function generateUserSourceMappings (cacheDir, directories, callback, frameworkName) {
	var files = getAllHeaderFiles(directories);
	var cacheToken = createHashFromString(frameworkName + JSON.stringify(files));
	var cachePathAndFilename = path.join(cacheDir, 'metabase-mappings-user-' + cacheToken + '.json');
	var cachedMappings = readFromCache(cachePathAndFilename);
	if (cachedMappings !== null) {
		util.logger.trace('Using cached include mappings for ' + frameworkName + '.');
		return callback(null, cachedMappings);
	}

	var result = {};
	files.forEach(function (fn) {
		var f = result[frameworkName] || {};
		extractImplementations(fn, f);
		result[frameworkName] = f;
	});
	writeToCache(cachePathAndFilename, result);
	return callback(null, result, false);
}

/**
 * Generates metadata for all frameworks known to the iOS builder.
 *
 * @param {Object} frameworks Object containing base info on all frameworks from the iOS builder
 * @param {String} cacheDir Path to cache directory
 * @param {Function} callback Callback function
 */
function generateUserFrameworksMetadata (frameworks, cacheDir, callback) {
	const frameworkNames = Object.keys(frameworks);
	const cacheToken = createHashFromString(frameworkNames.join(''));
	var cachePathAndFilename = path.join(cacheDir, 'metabase-user-frameworks-' + cacheToken + '.json');
	var cachedMetadata = readModulesMetadataFromCache(cachePathAndFilename);
	if (cachedMetadata !== null) {
		util.logger.trace('Using cached frameworks metadata.');
		return callback(null, cachedMetadata);
	}

	const modules = new Map();
	async.eachSeries(frameworkNames, (frameworkName, next) => {
		const frameworkInfo = frameworks[frameworkName];
		var metadata = new ModuleMetadata(frameworkInfo.name, frameworkInfo.path, frameworkInfo.type);
		var includes = {};
		generateFrameworkIncludeMap(metadata, includes, function (err) {
			if (err) {
				return next(err);
			}

			metadata.typeMap = includes[frameworkInfo.name];
			modules.set(metadata.name, metadata);
			next();
		});
	}, (err) => {
		if (err) {
			callback(err);
		}

		writeModulesMetadataToCache(modules, cachePathAndFilename);
		callback(null, modules);
	});
}

/**
 * Parses all headers under the given path and creates a mapping of all
 * implemented classes and their header file.
 *
 * This works for CocoaPods ObjC static libraries only
 *
 * @param {String} staticLibrariesHeaderPath Path to directory with static library headers
 * @param {Object} includes Map of interface names and their header file for each library
 * @param {Function} callback Callback function
 */
function generateStaticLibrariesIncludeMap (staticLibrariesHeaderPath, includes, callback) {
	var files = getAllHeaderFiles([ staticLibrariesHeaderPath ]);
	files.forEach(function (fn) {
		var fw;
		var pos = fn.lastIndexOf('/');
		fw = fn;
		if (pos > 0) {
			var ppos = fn.lastIndexOf('/', pos - 1);
			if (ppos) {
				fw = fn.substring(ppos + 1, pos);
			} else {
				fw = fn.substring(0, pos);
			}
		}
		var f = includes[fw] || {};
		extractImplementations(fn, f);
		includes[fw] = f;
	});

	return callback(null, includes, false);
}

/**
 * Parses the given framework and creates a mapping of all implemented classes
 * and their header file.
 *
 * Frameworks written in Swift are currently only supported if they provide an
 * ObjC interface header.
 *
 * @param {ModuleMetadata} frameworkMetadata Metadata object containing all framework related info
 * @param {Object} includes Map of class names and their header file
 * @param {Function} callback Callback function
 */
function generateFrameworkIncludeMap (frameworkMetadata, includes, callback) {
	var frameworkName = frameworkMetadata.name;
	var frameworkPath = frameworkMetadata.path;
	var frameworkHeadersPath = path.join(frameworkPath, 'Headers');

	// There are some rare frameworks (like FirebaseNanoPB) that do not have a Headers/ directory
	if (!fs.existsSync(frameworkHeadersPath)) {
		includes[frameworkName] = {};
		return callback();
	}

	util.logger.trace('Generating includes for ' + frameworkMetadata.type + ' framework ' + frameworkName.green + ' (' + frameworkPath + ')');
	if (frameworkMetadata.type === 'dynamic') {
		var modulesPath = path.join(frameworkPath, 'Modules');
		if (!fs.existsSync(modulesPath)) {
			return callback(new Error(`Modules directory for ${frameworkName} not found at expected path ${modulesPath}.`));
		}

		var moduleMapPathAndFilename = path.join(modulesPath, 'module.modulemap');
		if (!fs.existsSync(moduleMapPathAndFilename)) {
			return callback(new Error('Modulemap for ' + frameworkName + ' not found at expected path ' + moduleMapPathAndFilename + '. All dynamic frameworks need a module map to be usable with Hyperloop.'));
		}
		var moduleMap = fs.readFileSync(moduleMapPathAndFilename).toString();
		if (fs.readdirSync(modulesPath).length > 1) {
			// Dynamic frameworks containing Swift modules need to have an Objective-C
			// interface header defined to be usable
			frameworkMetadata.usesSwift = true;
			var objcInterfaceHeaderRegex = /header\s"(.+-Swift\.h)"/i;
			var objcInterfaceHeaderMatch = moduleMap.match(objcInterfaceHeaderRegex);
			if (objcInterfaceHeaderMatch !== null) {
				var objcInterfaceHeaderFilename = objcInterfaceHeaderMatch[1];
				var headerPathAndFilename = path.join(frameworkHeadersPath, objcInterfaceHeaderFilename);
				if (!fs.existsSync(headerPathAndFilename)) {
					return callback(new Error('Objective-C interface header for Swift-based framework ' + frameworkName.green + ' not found at expected path ' + headerPathAndFilename.cyan + '.'));
				}
				util.logger.trace('Swift based framework detected, parsing Objective-C interface header ' + objcInterfaceHeaderFilename.cyan);
				frameworkMetadata.umbrellaHeader = headerPathAndFilename;
				var implementationToHeaderFileMap = includes[frameworkName] || {};
				extractImplementations(headerPathAndFilename, implementationToHeaderFileMap);
				includes[frameworkName] = implementationToHeaderFileMap;
			} else {
				// TODO: New Swift metabase generator required to support pure Swift frameworks
				return callback(new Error('Incompatible framework ' + frameworkName + ' detected. Frameworks with Swift modules are only supported if they contain an Objective-C interface header.'));
			}
		} else {
			var umbrellaHeaderRegex = /umbrella header\s"(.+\.h)"/i;
			var umbrellaHeaderMatch = moduleMap.match(umbrellaHeaderRegex);
			if (umbrellaHeaderMatch !== null) {
				frameworkMetadata.umbrellaHeader = path.join(frameworkMetadata.path, 'Headers', umbrellaHeaderMatch[1]);
			}
			util.logger.trace('Objective-C only framework, parsing all header files');
			extractImplementationsFromFramework(frameworkName, frameworkPath, includes);
		}
	} else if (frameworkMetadata.type === 'static') {
		frameworkMetadata.umbrellaHeader = path.join(frameworkMetadata.path, 'Headers', `${frameworkMetadata.name}.h`);
		util.logger.trace('Static framework, parsing all header files');
		extractImplementationsFromFramework(frameworkName, frameworkPath, includes);
	} else {
		return callback(new Error('Invalid framework metadata, unknown type: ' + frameworkMetadata.type));
	}

	callback();
}

/**
 * Generates a mapping of symbols for CocoaPods third-party libraries and
 * frameworks.
 *
 * This can process both static libraries and frameworks (dynamic frameworks
 * need to expose an ObjC Interface Header).
 *
 * @param {String} cacheDir Path to the cache directory
 * @param {Object} builder iOSBuilder instance
 * @param {Function} callback Callback function
 */
function generateCocoaPodsMetadata (cacheDir, builder, settings, callback) {
	var podLockfilePathAndFilename = path.join(builder.projectDir, 'Podfile.lock');
	var cacheToken = calculateCacheTokenFromPodLockfile(podLockfilePathAndFilename);
	var cachePathAndFilename = path.join(cacheDir, 'metabase-cocoapods-' + cacheToken + '.json');
	var cachedMetadata = readModulesMetadataFromCache(cachePathAndFilename);
	if (cachedMetadata !== null) {
		util.logger.trace('Using cached CocoaPods metadata.');
		return callback(null, cachedMetadata);
	}

	var modules = new Map();
	var tasks = [];
	var includes = {};

	// Check static libraries
	var podDir = path.join(builder.projectDir, 'Pods');
	if (fs.existsSync(podDir)) {
		var staticLibrariesHeaderPath = path.join(podDir, 'Headers', 'Public');
		if (fs.existsSync(staticLibrariesHeaderPath)) {
			tasks.push(function (next) {
				generateStaticLibrariesIncludeMap(staticLibrariesHeaderPath, includes, () => {
					Object.keys(includes).forEach(libraryName => {
						const libraryPath = path.join(staticLibrariesHeaderPath, libraryName);
						const moduleMetadata = new ModuleMetadata(libraryName, libraryPath, ModuleMetadata.MODULE_TYPE_STATIC);
						moduleMetadata.umbrellaHeader = path.join(moduleMetadata.path, `${moduleMetadata.name}.h`);
						moduleMetadata.typeMap = includes[libraryName];
						modules.set(moduleMetadata.name, moduleMetadata);
					});

					next();
				});
			});
		}
	}

	// check for any frameworks under the CocoaPods FRAMEWORK_SEARCH_PATHS
	var cocoaPodsConfigurationBuildDir = getBuiltProductsRootPath(builder.projectDir, builder.xcodeTarget, builder.xcodeTargetOS);
	var frameworkSearchPaths = (settings.FRAMEWORK_SEARCH_PATHS || '').split(' ');
	tasks.push(function (next) {
		async.each(frameworkSearchPaths, function (frameworkSearchPath, done) {
			frameworkSearchPath = frameworkSearchPath.replace('${PODS_ROOT}', settings.PODS_ROOT);
			// TIMOB-25829: CocoaPods < 1.4.0 uses $PODS_CONFIGURATION_BUILD_DIR, 1.4.0+ uses ${PODS_CONFIGURATION_BUILD_DIR}
			// Remove regex once we bump the minimum version to 1.4.0+
			frameworkSearchPath = frameworkSearchPath.replace(/\$(\{)?(PODS_CONFIGURATION_BUILD_DIR)(\})?/, cocoaPodsConfigurationBuildDir);
			frameworkSearchPath = frameworkSearchPath.replace(/"/g, '');
			if (!fs.existsSync(frameworkSearchPath)) {
				return done();
			}
			detectFrameworks(frameworkSearchPath, function (err, frameworks) {
				if (err) {
					return done(err);
				}

				async.each(Array.from(frameworks.values()), function (frameworkMetadata, nextFramework) {
					if (modules.has(frameworkMetadata.name)) {
						// If no use_frameworks! flag is set in the Podfile it is possible
						// that we have a dummy static library whose headers are symlinked to
						// it's backing dynamic framework (e.g. Localytics). Skip parsing the
						// framework for now in those cases.
						return nextFramework();
					}

					generateFrameworkIncludeMap(frameworkMetadata, includes, () => {
						frameworkMetadata.typeMap = includes[frameworkMetadata.name];
						modules.set(frameworkMetadata.name, frameworkMetadata);
						nextFramework();
					});
				}, done);
			});
		}, next);
	});

	async.series(tasks, function (err) {
		if (err) {
			return callback(err);
		}

		writeModulesMetadataToCache(modules, cachePathAndFilename);
		callback(err, modules);
	});
}

/**
 * Detects all frameworks that are under the given search path and returns
 * basic metadata about their location and type
 *
 * @param {String} frameworkSearchPath Path where to search for frameworks
 * @param {Function} done Callback function
 */
function detectFrameworks(frameworkSearchPath, done) {
	var frameworks = new Map();
	async.each(fs.readdirSync(frameworkSearchPath), function (searchPathEntry, next) {
		var frameworkMatch = /([^/]+)\.framework$/.exec(searchPathEntry);
		if (frameworkMatch === null) {
			return next();
		}

		var frameworkName = frameworkMatch[1];
		var frameworkPath = path.join(frameworkSearchPath, searchPathEntry);
		var frameworkType = 'static';

		var binaryPathAndFilename = path.join(frameworkPath, frameworkName);
		var child = spawn('file', [ '-b', binaryPathAndFilename ]);
		child.stdout.on('data', function (data) {
			if (data.toString().indexOf('dynamically linked shared library') !== -1) {
				frameworkType = 'dynamic';
			}
		});
		child.stderr.on('data', function (data) {
			util.logger.error(data.toString());
		});
		child.on('close', function (code) {
			if (code !== 0) {
				return next(new Error('Could not detect framework type, command exited with code ' + code));
			}

			frameworks.set(frameworkName, new ModuleMetadata(frameworkName, frameworkPath, frameworkType));

			next();
		});
	}, function (err) {
		if (err) {
			done(err);
		}

		done(null, frameworks);
	});
}

/**
 * Calculates a cache token based on the Podfile checksum and all installed pod
 * specs checksums.
 *
 * If one of these checksums change, either the Podfile changed or a Pod was
 * updated/installed/removed, resulting in a changed cache token and the
 * CocoaPods symbol mapping will be regenerated.
 *
 * @param {string} podLockfilePathAndFilename Path and filename of the Pod lockfile
 * @return {string} The generated cache token
 */
function calculateCacheTokenFromPodLockfile (podLockfilePathAndFilename) {
	if (!fs.existsSync(podLockfilePathAndFilename)) {
		throw new Error('No Podfile.lock found in your project root. ');
	}
	var cacheTokenData = { podfile: '', specs: [] };
	var podLockfileContent = fs.readFileSync(podLockfilePathAndFilename).toString();
	var specChecksumRegex = /[ ]{2}[^.][^\s/]*:\s(.*)/ig;
	var checksumMatches = specChecksumRegex.exec(podLockfileContent);
	if (checksumMatches === null) {
		throw new Error('Could not read sepc checksums from Podfile.lock');
	}
	while (checksumMatches !== null) {
		cacheTokenData.specs.push(checksumMatches[1]);
		checksumMatches = specChecksumRegex.exec(podLockfileContent);
	}
	var podfileChecksumMatch = podLockfileContent.match(/PODFILE CHECKSUM: (.*)/);
	if (podfileChecksumMatch === null) {
		throw new Error('Could not read Podfile checksum from Podfile.lock');
	}
	cacheTokenData.podfile = podfileChecksumMatch[1];
	return createHashFromString(JSON.stringify(cacheTokenData));
}

/**
 * Gets the full path to the built products directory for the current Xcode build
 * configuration name and SDK type.
 *
 * @param {String} basePath Project root path
 * @param {String} configurationName Active configuration name, i.e. Debug, Release
 * @param {String} sdkType Active SDK type, i.e. iphone or iphonesimulator
 * @return {String} Full path the the products directory
 */
function getBuiltProductsRootPath (basePath, configurationName, sdkType) {
	return path.join(basePath, 'build/iphone/build/Products', configurationName + '-' + sdkType);
}

/**
 * Gets JSON encoded data from a cache file.
 *
 * @param {String} cacheDir Path to the cache directory
 * @param {String} cacheToken Hash to identifiy the required cache file
 * @return {Object} The CocoaPods metabase mappings
 */
function readFromCache (cachePathAndFilename) {
	if (!fs.existsSync(cachePathAndFilename)) {
		return null;
	}

	try {
		return JSON.parse(fs.readFileSync(cachePathAndFilename).toString());
	} catch (e) {
		util.logger.debug(e);
		util.logger.warn('Could not parse cached metabase mappings from ' + cachePathAndFilename + ', regenerating...');
	}

	return null;
}

/**
 * Stores the given data in a cache file as JSON.
 *
 * @param {String} cacheDir Path of the cache file to write to
 * @param {Object} data The include mappings to store
 */
function writeToCache (cachePathAndFilename, data) {
	var cacheDir = path.dirname(cachePathAndFilename);
	if (!fs.existsSync(cacheDir)) {
		fs.mkdirSync(cacheDir);
	}

	fs.writeFileSync(cachePathAndFilename, JSON.stringify(data));
}

function writeModulesMetadataToCache(modules, cachePathAndFilename) {
	const modulesObject = {};
	modules.forEach((entry, key) => {
		if (entry instanceof ModuleMetadata) {
			modulesObject[entry.name] = entry.toJson();
		}
		if (key === '$metadata') {
			modulesObject.$metadata = entry;
		}
	});
	const cacheDir = path.dirname(cachePathAndFilename);
	if (!fs.existsSync(cacheDir)) {
		fs.mkdirSync(cacheDir);
	}
	fs.writeFileSync(cachePathAndFilename, JSON.stringify(modulesObject));
}

function readModulesMetadataFromCache(cachePathAndFilename) {
	if (!fs.existsSync(cachePathAndFilename)) {
		return null;
	}

	let json = {};
	try {
		json = JSON.parse(fs.readFileSync(cachePathAndFilename));
	} catch (e) {
		return null;
	}

	const modules = new Map();
	Object.keys(json).forEach(entryName => {
		if (entryName === '$metadata') {
			modules.set('$metadata', json[entryName]);
			return;
		}

		modules.set(entryName, ModuleMetadata.fromJson(json[entryName]));
	});

	return modules;
}

/**
 * handle buffer output
 */
function createLogger (obj, fn) {
	return (function () {
		var cur = '';
		obj.on('data', function (buf) {
			cur += buf;
			if (cur.charAt(cur.length - 1) === '\n') {
				cur.split(/\n/).forEach(function (line) {
					line && fn(chalk.green('CocoaPods') + ' ' + line);
				});
				cur = '';
			}
		});
		obj.on('exit', function () {
			// flush
			if (cur) {
				cur.split(/\n/).forEach(function (line) {
					line && fn(chalk.green('CocoaPods') + ' ' + line);
				});
			}
		});
	}());
}

/**
 * run the ibtool
 */
function runIBTool (runDir, args, callback) {
	var spawn = require('child_process').spawn,
		child = spawn('/usr/bin/ibtool', args, { cwd: runDir });
	util.logger.debug('running /usr/bin/ibtool ' + args.join(' ') + ' ' + runDir);
	createLogger(child.stdout, util.logger.trace);
	createLogger(child.stderr, util.logger.warn);
	child.on('error', callback);
	child.on('exit', function (ec) {
		if (ec !== 0) {
			return callback(new Error('the ibtool failed running from ' + runDir));
		}
		callback();
	});
}

function runMomcTool (runDir, sdk, args, callback) {
	var spawn = require('child_process').spawn,
		child = spawn('/usr/bin/xcrun', [ '--sdk', sdk, 'momc' ].concat(args), { cwd: runDir });
	util.logger.debug('running /usr/bin/xcrun momc' + args.join(' ') + ' ' + runDir);
	createLogger(child.stdout, util.logger.trace);
	createLogger(child.stderr, util.logger.warn);
	child.on('error', callback);
	child.on('exit', function (ec) {
		if (ec !== 0) {
			return callback(new Error('the xcrun momc failed running from ' + runDir));
		}
		callback();
	});
}

function runMapcTool (runDir, sdk, args, callback) {
	var spawn = require('child_process').spawn,
		child = spawn('/usr/bin/xcrun', [ '--sdk', sdk, 'mapc' ].concat(args), { cwd: runDir });
	util.logger.debug('running /usr/bin/xcrun mapc' + args.join(' ') + ' ' + runDir);
	createLogger(child.stdout, util.logger.trace);
	createLogger(child.stderr, util.logger.warn);
	child.on('error', callback);
	child.on('exit', function (ec) {
		if (ec !== 0) {
			return callback(new Error('the xcrun mapc failed running from ' + runDir));
		}
		callback();
	});
}

function compileResources (dir, sdk, appDir, wildcard, callback) {
	// copy them into our target
	var files = recursiveReadDir(dir);
	async.each(files, function (file, cb) {
		var rel = path.basename(path.relative(dir, file));
		var args;
		switch (path.extname(rel)) {
			case '.xib': {
				args = [
					'--reference-external-strings-file',
					'--errors',
					'--output-format', 'binary1',
					'--compile', path.join(appDir, rel.replace(/\.xib$/, '.nib')),
					'--sdk', sdk,
					file
				];
				return runIBTool(path.dirname(file), args, cb);
			}
			case '.xcdatamodel': {
				args = [
					file,
					path.join(appDir, rel.replace(/\.xcdatamodel$/, '.mom'))
				];
				return runMomcTool(path.dirname(file), sdk, args, cb);
			}
			case '.xcdatamodeld': {
				args = [
					file,
					path.join(appDir, rel.replace(/\.xcdatamodeld$/, '.momd'))
				];
				return runMomcTool(path.dirname(file), sdk, args, cb);
			}
			case '.xcmappingmodel': {
				args = [
					file,
					path.join(appDir, rel.replace(/\.xcmappingmodel$/, '.cdm'))
				];
				return runMapcTool(path.dirname(file), sdk, args, cb);
			}
			case '.xcassets': {
				// FIXME:
				break;
			}
			case '.storyboard': {
				args = [
					'--reference-external-strings-file',
					'--errors',
					'--output-format', 'binary1',
					'--compile', path.join(appDir, rel.replace(/\.storyboard$/, '.storyboardc')),
					'--sdk', sdk,
					file
				];
				return runIBTool(path.dirname(file), args, cb);
			}
			default: {
				if (wildcard) {
					if (!/\.(m|mm|h|cpp|hpp|c|s)$/.test(file)) {
						var buf = fs.readFileSync(file);
						var out = path.join(appDir, rel);
						var d = path.dirname(out);

						fs.ensureDirSync(d);
						util.logger.trace('Copying Resource', chalk.cyan(file), 'to', chalk.cyan(out));

						return fs.writeFile(out, buf, cb);
					}
				}
				break;
			}
		}
		cb();
	}, callback);
}

/**
 * Runs CocoaPods to build any required libraries
 *
 * @param basedir {String}
 * @param builder {iOSBuilder}
 * @param callback {Function}
 */
function runCocoaPodsBuild (basedir, builder, callback) {
	var sdkType = builder.xcodeTargetOS,
		sdkVersion = builder.iosSdkVersion,
		minSDKVersion = builder.minIosVer,
		xcodesettings = builder.xcodeEnv.executables,
		spawn = require('child_process').spawn,
		// Make sure SDK version is always in MAJOR.MINOR format
		sdk = sdkType + (/\d+\.\d+\.\d+/.test(sdkVersion) ? sdkVersion.substring(0, sdkVersion.lastIndexOf('.')) : sdkVersion),
		productsDirectory = path.join(basedir, 'build/iphone/build/Products'),
		buildConfigurationName = builder.xcodeTarget,
		args = [
			'-configuration', buildConfigurationName,
			'-alltargets',
			'IPHONEOS_DEPLOYMENT_TARGET=' + minSDKVersion,
			'-sdk', sdk,
			'SYMROOT=' + productsDirectory,
			'ONLY_ACTIVE_ARCH=NO'
		];
	var buildOutDir = path.join(productsDirectory, buildConfigurationName + '-' + sdkType),
		runDir = path.join(basedir, 'Pods'),
		child = spawn(xcodesettings.xcodebuild, args, { cwd: runDir });
	util.logger.debug('running ' + xcodesettings.xcodebuild + ' ' + args.join(' ') + ' ' + runDir);
	util.logger.info('Building ' + chalk.green('CocoaPods') + ' dependencies');
	createLogger(child.stdout, util.logger.trace);
	createLogger(child.stderr, util.logger.warn);
	child.on('error', callback);
	child.on('exit', function (ec) {
		if (ec !== 0) {
			return callback(new Error('the xcodebuild failed running from ' + runDir));
		}
		if (!fs.existsSync(buildOutDir)) {
			return callback(new Error('xcodebuild did not produce the expected CocoaPods libraries at ' + buildOutDir));
		}

		return callback();
	});
}

/**
 * parse the xcconfig file
 */
function parseCocoaPodXCConfig (fn) {
	var config = {};
	fs.readFileSync(fn).toString().split('\n').forEach(function (line) {
		var i = line.indexOf(' = ');
		if (i > 0) {
			var k = line.substring(0, i).trim();
			var v = line.substring(i + 2).trim();
			config[k] = v;
		}
	});
	return config;
}

/**
 * generate a map of xcode settings for CocoaPods
 */
function getCocoaPodsXCodeSettings (basedir) {
	var podDir = path.join(basedir, 'Pods');
	if (fs.existsSync(podDir)) {
		var target = path.join(podDir, 'Target Support Files'),
			name = fs.readdirSync(target).filter(function (n) { return n.indexOf('Pods-') === 0; })[0],
			dir = path.join(target, name);
		if (fs.existsSync(dir)) {
			var fn = path.join(dir, name + '.release.xcconfig');
			if (fs.existsSync(fn)) {
				var config = parseCocoaPodXCConfig(fn);
				if (config.PODS_ROOT) {
					// fix the PODS_ROOT to point to the absolute path
					config.PODS_ROOT = path.resolve(podDir);
				}
				return config;
			}
		}
	}
}

function isPodInstalled (callback) {
	var exec = require('child_process').exec;
	return exec('which pod', function (err, stdout) {
		if (err) {
			return callback(new Error('CocoaPods not found in your PATH. You can install CocoaPods with: sudo gem install cocoapods'));
		}
		return callback(null, stdout.trim());
	});
}

/**
 * Determines the currently installed version of CocoaPods
 *
 * @param {Function} callback
 */
function getCocoaPodsVersion (callback) {
	var exec = require('child_process').exec;
	return exec('pod --version', function (err, stdout) {
		if (err) {
			return callback(new Error('CocoaPods not found in your PATH. You can install CocoaPods with: sudo gem install cocoapods'));
		}
		return callback(null, stdout.trim());
	});
}

function validatePodfile (podfilePath, version, callback) {
	var podfileContent = fs.readFileSync(podfilePath);
	if (semver.gte(version, '1.0.0')) {
		if (!/:integrate_targets\s*=>\s*false/.test(podfileContent)) {
			util.logger.error('Hyperloop requires your Podfile to include :integrate_target => false as an installation option:');
			util.logger.error('');
			util.logger.error('    install! \'cocoapods\', :integrate_targets => false');
			util.logger.error('');
			util.logger.error('For more information please see https://guides.cocoapods.org/syntax/podfile.html#install_bang');
			return callback(new Error('Your Podfile requires changes to use it with Hyperloop. Please see the note above on how to fix it.'));
		}
	}
	return callback();
}

function runPodInstallIfRequired(basedir, callback) {
	var Pods = path.join(basedir, 'Pods'),
		Podfile = path.join(basedir, 'Podfile'),
		cacheToken =  createHashFromString(fs.readFileSync(Podfile)),
		cacheFile = path.join(basedir, 'build', '.podcache');

	fs.ensureDirSync(path.dirname(cacheFile));

	if (!fs.existsSync(Pods) || !fs.existsSync(cacheFile) || (fs.existsSync(cacheFile) && fs.readFileSync(cacheFile).toString() !== cacheToken)) {
		async.waterfall([
			isPodInstalled,
			function (pod, callback) {
				getCocoaPodsVersion(function (err, version) {
					callback(err, pod, version);
				});
			},
			function (pod, version, callback) {
				validatePodfile(Podfile, version, function (err) {
					callback(err, pod, version);
				});
			}
		], function (err, pod, version) {
			if (err) { return callback(err); }
			util.logger.trace('Found CocoaPods ' + version + ' (' + pod + ')');
			if (semver.lt(version, '1.0.0')) {
				util.logger.error('Using a CocoaPods < 1.0.0 is not supported anymore. Please update your CocoaPods installation with: ' + chalk.blue('sudo gem install cocoapods'));
				return callback(new Error('Using a CocoaPods < 1.0.0 is not supported anymore.'));
			}
			util.logger.info(chalk.green('CocoaPods') + ' dependencies found. This will take a few moments but will be cached for subsequent builds');
			var spawn = require('child_process').spawn;
			var args = [ 'install' ];
			var child = spawn(pod, args, { cwd: basedir });
			createLogger(child.stdout, util.logger.trace);
			createLogger(child.stderr, util.logger.warn);
			child.on('error', callback);
			child.on('exit', function (ec) {
				if (ec !== 0) {
					return callback(new Error('pod install returned a non-zero exit code: ' + ec));
				}
				fs.writeFileSync(cacheFile, cacheToken);
				return callback();
			});
		});
	} else {
		callback();
	}
}

function generateCocoaPods (cachedir, builder, callback) {
	var basedir = builder.projectDir;
	var Podfile = path.join(basedir, 'Podfile');
	if (!fs.existsSync(Podfile)) {
		util.logger.debug('No CocoaPods Podfile found. Skipping ...');
		return callback();
	}

	var content = fs.readFileSync(Podfile).toString();

	if (content.indexOf('pod ') === -1) {
		util.logger.warn('Podfile found, but no Pod\'s specified. Skipping ...');
		return callback();
	}

	if (/^use_frameworks!$/m.test(content) === false) {
		util.logger.warn('Using CocoaPods without the "use_frameworks!" flag is deprecated since Hyperloop 3.0.2 and will be removed in Hyperloop 4.0.0.');
		util.logger.warn('Please add "use_frameworks!" to your Podfile to remain compatible with future versions of Hyperloop.');
	}

	runPodInstallIfRequired(basedir, function (err) {
		if (err) {
			return callback(err);
		}

		runCocoaPodsBuild(basedir, builder, function (err) {
			if (err) {
				return callback(err);
			}

			var settings = getCocoaPodsXCodeSettings(basedir);
			util.logger.trace(chalk.green('CocoaPods') + ' Xcode settings will', JSON.stringify(settings, null, 2));

			generateCocoaPodsMetadata(cachedir, builder, settings, function (err, includes) {
				return callback(err, settings, includes);
			});
		});
	});
}

// public API
exports.getSystemFrameworks = getSystemFrameworks;
exports.generateUserSourceMappings = generateUserSourceMappings;
exports.generateUserFrameworksMetadata = generateUserFrameworksMetadata;
exports.generateMetabase = generateMetabase;
exports.generateCocoaPods = generateCocoaPods;
exports.compileResources = compileResources;
exports.recursiveReadDir = recursiveReadDir;
exports.generateSwiftMetabase = swiftlilb.generateSwiftMetabase;
exports.generateSwiftMangledClassName = swiftlilb.generateSwiftMangledClassName;
exports.appleVersionToSemver = appleVersionToSemver;
exports.ModuleMetadata = ModuleMetadata;

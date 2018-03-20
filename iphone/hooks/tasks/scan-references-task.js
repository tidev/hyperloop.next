// TODO Use incremental task like in Android hook!
'use strict';

const babylon = require('babylon');
const t = require('babel-types');
const generate = require('babel-generator').default;
const traverse = require('babel-traverse').default;
const deasync = require('deasync');

const requireRegexp = /[\w_/\-\\.]+/ig;

/**
 * Determines whether the module required/imported is obviously not a native
 * type reference (so we can avoid looking for a matching framework from it)
 * @param  {String} moduleName module name from a require call/import statement
 * @return {boolean}
 */
function shouldSkip(moduleName) {
	return moduleName.startsWith('alloy/') || moduleName.charAt(0) === '.' || moduleName.charAt(0) === '/';
}

/**
 * Is the reference to a "builtin"?
 * TODO: Delegate to code in generate library where we handle builtins?
 * @param  {String} frameworkName possible framework name
 * @return {boolean}
 */
function isBuiltin(frameworkName) {
	return frameworkName === 'Titanium';
}

/**
 * Appends a value to the existing array of values for a given key in a Map.
 * If no existing array, put the value inside an array and insert it into the Map.
 * @param  {Map<string, string[]>} refs map of references to insert value into
 * @param  {string} key key we're inserting value under
 * @param  {string} value value to insert (in an array) in the map
 */
function appendReference(refs, key, value) {
	if (refs.has(key)) {
		const existing = refs.get(key);
		existing.push(value);
		refs.set(key, existing);
	} else {
		refs.set(key, [ value ]);
	}
}

/**
 * [scanForReferences description]
 * @param  {String} contents source code of the file
 * @param  {String} filename path to the file
 * @param  {Map<string, ModuleMetadata>} frameworks [description]
 * @param  {String} cacheDir   directory to read/write metabase cache files
 * @param  {SDKEnvironment} sdk sdk info object
 * @param  {String} sdk.sdkPath    path to SDK to use (to generate metabase)
 * @param  {String} sdk.minVersion minimum iOS version , i.e. '9.0'
 * @param  {Object} logger     logger to use
 * @return {Object} Object holding 'references' key with value of
 * Map<string, string[]> (framework name -> types used), 'replacedContent' key
 * with value of updated source code after requires are replaced.
 */
function scanForReferences(contents, filename, frameworks, cacheDir, sdk, logger) {
	const references = new Map(); // gather map of references: framework name -> array of type names

	function asyncTypeExistsInFramework(framework, typeName, callback) {
		logger.trace('Checking require for: ' + framework.name.toLowerCase() + '/' + typeName.toLowerCase());
		framework.generateMetabase(cacheDir, sdk)
			.then(json => {
				// we should have a metabase just for this framework now, if we could find such a framework!
				// Does the type exist as a class or enum in this framework?
				callback(null, json.classes[typeName] || json.enums[typeName]);
			})
			.catch(err => callback(err));
	}
	// Need to make deasync so babel AST visitor can run in sync fashion!
	const typeExistsInFramework = deasync(asyncTypeExistsInFramework);

	let modified = false; // track if we made changes, so we can avoid generating new code if we didn't
	const HyperloopVisitor = {
		// ES5-style require calls
		CallExpression: function (p) {
			const theString = p.node.arguments[0];
			let requireMatch;
			if (p.get('callee').isIdentifier({ name: 'require' }) // Is this a require call?
				&& theString && t.isStringLiteral(theString)     // Is the 1st param a literal string?
				&& !shouldSkip(theString.value) // is this a relative or absolute path? Is it a known framework like alloy?
				&& (requireMatch = theString.value.match(requireRegexp)) !== null // Is it a hyperloop require?
			) {

				const tok = requireMatch[0].split('/');
				const pkg = tok[0];
				const className = tok[1] || pkg;

				if (isBuiltin(pkg)) {
					// handle as a builtin!
					const ref = 'hyperloop/' + pkg.toLowerCase() + '/' + className.toLowerCase();
					appendReference(references, pkg, className);

					// replace the require to point to our generated file path
					p.replaceWith(t.callExpression(p.node.callee, [ t.stringLiteral('/' + ref) ]));
					modified = true;
					return;
				}

				const framework = frameworks.get(pkg);

				// Are they trying to require a name close to a framework name?
				if (!framework) {
					// This is helpful, though not necessary...
					const pkgSoundEx = soundEx(pkg);
					const maybes = Array.from(frameworks.keys()).filter(function (frameworkName) {
						return soundEx(frameworkName) === pkgSoundEx;
					});

					if (maybes.length) {
						logger.warn('The iOS framework "' + pkg + '" could not be found. Are you trying to use '
							+ maybes.map(function (s) { return '"' + s + '"'; }).join(' or ') + ' instead? (' + filename + ')');
					}
					// don't inject anything
					return;
				}

				if (!typeExistsInFramework(framework, className)) {
					// TODO Be helpful in suggesting type names?
					// self.frameworks.forEach(frameworkMetadata => {
					// 	if (frameworkMetadata.typeMap[className]) {
					// 		throw new Error('Are you trying to use the iOS class "' + className + '" located in the framework "' + frameworkMetadata.name + '", not in "' + pkg + '"? (' + relPath + ')');
					// 	}
					//
					// 	if (soundEx(frameworkMetadata.name) === classNameSoundEx) {
					// 		throw new Error('The iOS class "' + className + '" could not be found in the framework "' + pkg + '". Are you trying to use "' + frameworkMetadata.name + '" instead? (' + relPath + ')');
					// 	}
					// }, self);
					throw new Error('The iOS class "' + className + '" could not be found in the framework "' + pkg + '". (' + filename + ')');
				}
				logger.trace('Found hyperloop native type reference: ' + pkg + '/' + className);
				appendReference(references, pkg, className);

				// record our includes in which case we found a match
				// self.includes[include] = 1; // FIXME: this should be the filename/header where this type was declared!

				// replace the require to point to our generated file path
				const ref = 'hyperloop/' + pkg.toLowerCase() + '/' + className.toLowerCase();
				p.replaceWith(t.callExpression(p.node.callee, [ t.stringLiteral('/' + ref) ]));
				modified = true;
			}
		},
		// ES6+-style imports
		ImportDeclaration: function (p) {
			const theString = p.node.source;
			const replacements = [];
			let requireMatch;
			if (theString && t.isStringLiteral(theString)   // module name is a string literal
				&& !shouldSkip(theString.value) // is this a relative or absolute path? Is it a known framework like alloy?
				&& (requireMatch = theString.value.match(requireRegexp)) !== null // Is it a hyperloop require?
			) {
				const tok = requireMatch[0].split('/');
				const pkg = tok[0];
				const wasBuiltin = isBuiltin(pkg);
				const framework = frameworks.get(pkg);

				// Are they trying to require a name close to a framework name?
				if (!framework && !wasBuiltin) {
					// This is helpful, though not necessary...
					const pkgSoundEx = soundEx(pkg);
					const maybes = Array.from(frameworks.keys()).filter(function (frameworkName) {
						return soundEx(frameworkName) === pkgSoundEx;
					});

					if (maybes.length) {
						logger.warn('The iOS framework "' + pkg + '" could not be found. Are you trying to use '
							+ maybes.map(function (s) { return '"' + s + '"'; }).join(' or ') + ' instead? (' + filename + ')');
					}
					// don't inject anything
					return;
				}
				// Now iterate over specifiers to get the type we're trying to get!
				p.node.specifiers.forEach(function (spec) {
					// import UIView from 'UIKit/UIView'; spec.imported is undefined and tok[1] holds className
					// import { UIView } from 'UIKit'; spec.imported.name == 'UIView'
					const className = (spec.imported ? spec.imported.name : tok[1]);

					if (!isBuiltin && !typeExistsInFramework(framework, className)) {
						// TODO Be helpful in suggesting type names
						// const classNameSoundEx = soundEx(className);
						//
						// self.frameworks.forEach(frameworkMetadata => {
						// 	if (frameworkMetadata.typeMap[className]) {
						// 		throw new Error('Are you trying to use the iOS class "' + className + '" located in the framework "' + frameworkMetadata.name + '", not in "' + pkg + '"? (' + relPath + ')');
						// 	}
						//
						// 	if (soundEx(frameworkMetadata.name) === classNameSoundEx) {
						// 		throw new Error('The iOS class "' + className + '" could not be found in the framework "' + pkg + '". Are you trying to use "' + frameworkMetadata.name + '" instead? (' + relPath + ')');
						// 	}
						// }, self);

						throw new Error('The iOS class "' + className + '" could not be found in the framework "' + pkg + '". (' + filename + ')');
					}

					appendReference(references, pkg, className);
					// replace the require to point to our generated file path
					const ref = 'hyperloop/' + pkg.toLowerCase() + '/' + className.toLowerCase();
					replacements.push(t.importDeclaration([ t.importDefaultSpecifier(spec.local) ], t.stringLiteral('/' + ref)));
				});

				// Apply replacements
				if (replacements.length > 0) {
					if (replacements.length === 1) {
						p.replaceWith(replacements[0]);
					} else {
						p.replaceWithMultiple(replacements);
					}
					modified = true;
				}
			}
		}
	};

	const ast = babylon.parse(contents, { sourceFilename: filename, sourceType: 'module' });
	traverse(ast, HyperloopVisitor);
	// Avoid generating if we never replaced anything!
	const newContents = modified ? generate(ast, {}).code : contents;

	return {
		references: references, // Map<string, string[]>: framework name -> types
		replacedContent: newContents // string
	};
}

/**
 * Computes the soundex for a string.
 * https://github.com/LouisT/node-soundex/blob/master/index.js
 * @param {String} str - The string to analyze.
 * @param {Boolean} [scale=false] - If true, a Higgs boson is created.
 * @returns {String}
 */
function soundEx(str, scale) {
	var split = String(str).toUpperCase().replace(/[^A-Z]/g, '').split(''),
		map = {
			BFPV: 1,
			CGJKQSXZ: 2,
			DT: 3,
			L: 4,
			MN: 5,
			R: 6
		},
		keys = Object.keys(map).reverse();

	var build = split.map(function (letter) { // eslint-disable-line
		for (var num in keys) {
			if (keys[num].indexOf(letter) !== -1) {
				return map[keys[num]];
			}
		}
	});
	var first = build.shift();

	build = build.filter(function (num, index, array) {
		return ((index === 0) ? num !== first : num !== array[index - 1]);
	});

	var len = build.length,
		max = (scale ? ((max = ~~((len * 2 / 3.5))) > 3 ? max : 3) : 3);

	return split[0] + (build.join('') + (new Array(max + 1).join('0'))).slice(0, max);
}

exports.scanForReferences = scanForReferences;

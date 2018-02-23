'use strict';
const logger = require('./util').logger;

/**
 * [generateImport description]
 * @param  {string} name [description]
 * @param  {string} fp   [description]
 * @return {[type]}      [description]
 */
function generateImport(name, fp) {
	return '\t$imports.' + name + ' = require(\'/hyperloop/' + fp.toLowerCase() + '\');';
}

/**
 * [makeImports description]
 * @param  {object} json    metabase
 * @param  {object} imports [description]
 * @return {string}
 */
function makeImports(json, imports) {
	const results = [];
	Object.keys(imports).forEach(function (k) {
		const e = imports[k];
		if (k === 'NSObject' && e && !e.framework) {
			e.framework = 'Foundation';
		}
		if (!e) {
			// console.error("Can't find", k, " with entry:", e);
			return;
		}
		if (e.framework) {
			const fp = (e.framework + '/' + k).toLowerCase();
			results.push(generateImport(k, fp));
		} else if (e.filename) {
			// TODO:
			results.push(generateImport(k, e.filename));
		} else {
			logger.warn('Can\'t figure out how to import', k, e);
		}
	});
	return results.join('\n');
}

exports.makeImports = makeImports;

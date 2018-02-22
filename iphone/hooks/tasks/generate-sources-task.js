'use strict';
// TODO This should generate JS wrappers for native types!
const generator = require('../generate');

/**
 * Given a unified metabase, the parserState (which tracks symbol references),
 * the list of wrapper references, and the frameworks - generates JS wrappers.
 * @param  {string}   outputDir    Where to place the generated JS wrappers
 * @param  {string}   name         app name?
 * @param  {object}   metabase     Unified metabase from all references frameworks (and their dependencies)
 * @param  {ParserState}   parserState  parser state that tracks low-level symbol references?
 * @param  {Map<string, ModuleMetadata>}   frameworkMap [description]
 * @param  {object}   references   really used as Set<string> where the keys are hyperloop wrapper references (i.e. '/hyperloop/uikit/uilabel.js')
 * @param  {object}   logger       logger
 * @param  {Function} callback     async callback function.
 * @return {void}
 */
function generateSources(outputDir, name, metabase, parserState, frameworkMap, references, logger, callback) {
	const fauxBuilder = {
		parserState: parserState,
		metabase: metabase,
		references: references,
		frameworks: frameworkMap
	};

	// now generate the stubs
	logger.debug('Generating stubs');
	const started = Date.now();
	// TODO: Can we break apart the generation of builtins, versus generating wrappers per-framework, etc?
	// const builtinsMetabase = { classes: {} };
	// generator.generateBuiltins(builtinsMetabase, function (err, result) {
	// 	// ok builtinsMetabase should now be good to generate stubs with!
	// });

	generator.generateFromJSON(
		name,
		metabase,
		parserState,
		function (err, sourceSet, modules) {
			if (err) {
				return callback(err);
			}

			const codeGenerator = new generator.CodeGenerator(sourceSet, modules, fauxBuilder);
			codeGenerator.generate(outputDir);

			const duration = Date.now() - started;
			logger.info('Generation took ' + duration + ' ms');

			callback();
		},
		frameworkMap
	);
}

exports.generateSources = generateSources;

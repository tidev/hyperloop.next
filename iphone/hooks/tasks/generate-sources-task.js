'use strict';
// TODO This should generate JS wrappers for native types!
const generator = require('../generate');

function generateSources(outputDir, name, metabase, parserState, frameworkMap, references, logger, callback) {
	// if (!this.parserState) {
	// 	this.logger.info('Skipping ' + HL + ' stub generation. Empty AST.');
	// 	return callback();
	// }
	// if (!this.forceStubGeneration) {
	// 	this.logger.debug('Skipping stub generation');
	// 	return callback();
	// }

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

'use strict';

const gulp = require('gulp');
const changed = require('gulp-changed');

/**
 * Use gulp to pipe generated JS wrapper files to the final output directory, but only those that actually have changed!
 * @param  {string} inDir      The folder containing the generated JS wrapper files
 * @param  {string} outDir     The output directory
 * @returns {void}
 */
function copy(inDir, outDir) {
	return gulp.src(inDir + '/**/*.js') // grab all js files recursively under the "input" dir
		// the `changed` task needs to know the destination directory
		// upfront to be able to figure out which files changed
		.pipe(changed(outDir))
		// only files that has changed will pass through here
		.pipe(gulp.dest(outDir));
}
exports.copy = copy;

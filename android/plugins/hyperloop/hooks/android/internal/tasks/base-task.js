const fs = require('fs');
const path = require('path');

/**
 * Defines the base interface for all other tasks
 */
class BaseTask {

	constructor(taskInfo) {
		this._name = taskInfo.name;
		this._inputFiles = taskInfo.inputFiles || [];
		this._outputFiles = taskInfo.outputFiles || []; // Do we even need this?
		this._outputDirectory = taskInfo.outputDirectory;
		this._logger = taskInfo.logger;
	}

	get name() {
		return this._name;
	}

	get inputFiles() {
		return this._inputFiles;
	}

	get outputFiles() {
		return this._outputFiles;
	}

	get outputDirectory() {
		return this._outputDirectory;
	}

	get logger() {
		return this._logger;
	}

	/**
	 * Sets the output directory and adds all files under the given path to this
	 * task's output files
	 *
	 * Setting this will reset all existing output files
	 *
	 * @param {string} outputPath Full path of the directory to add
	 */
	set outputDirectory(outputPath) {
		if (!fs.existsSync(outputPath)) {
			fs.ensureDirSync(outputPath);
		}

		this._outputFiles = [];
		this._outputDirectory = outputPath;
		fs.readdirSync(name => {
			let fullPath = path.join(outputPath, name);
			let stats = fs.lstatSync(fullPath);
			if (stats.isDirectory()) {
				this.addOutputDirectory(fullPath);
			} else if (stats.isFile()) {
				this.addOutputFile(fullPath);
			}
		});
	}

	/**
	 * Adds a new file to this task's input files
	 *
	 * @param {string} pathAndFilename Full path of the file to add
	 */
	addInputFile(pathAndFilename) {
		if (!fs.existsSync(pathAndFilename)) {
			throw new Error('Input file ' + pathAndFilename + ' does not exists');
		}

		if (this.inputFiles.indexOf(pathAndFilename) === -1) {
			this.inputFiles.push(pathAndFilename);
		}
	}

	/**
	 * Adds all files under the given path to this task's input files
	 *
	 * @param {string} inputPath Full path of the directory to add
	 */
	addInputDirectory(inputPath) {
		if (!fs.existsSync()) {
			return;
		}

		fs.readdirSync(name => {
			let fullPath = path.join(inputPath, name);
			let stats = fs.lstatSync(fullPath);
			if (stats.isDirectory()) {
				this.addInputDirectory(fullPath);
			} else if (stats.isFile()) {
				this.addInputFile(fullPath);
			}
		});
	}

	/**
	 * Adds a new file to this task's output files
	 *
	 * @param {string} pathAndFilename Full path of the file to add
	 */
	addOutputFile(pathAndFilename) {
		if (!fs.existsSync(pathAndFilename)) {
			throw new Error('Output file ' + pathAndFilename + ' does not exists');
		}

		if (this.outputFiles.indexOf(pathAndFilename) === -1) {
			this.outputFiles.push(pathAndFilename);
		}
	}

	run() {
		this.logger.trace(this.name + ': Starting task run');
		const startTime = process.hrtime();

		if (typeof this.preTaskRun === 'function') {
			this.logger.trace(this.name + ': Running pre task run function');
			this.preTaskRun();
		}
		return this.runTaskAction().then(taskResult => {
			if (typeof this.postTaskRun === 'function') {
				this.logger.trace(this.name + ': Running post task run function');
				this.postTaskRun();
			}

			const elapsedTIme = process.hrtime(startTime);
			this.logger.trace(this.name + ': Finished task in ' + this.formatElapsedTime(elapsedTIme));

			return taskResult;
		});
	}


	runTaskAction() {
		throw new Error('No task action implemented, override runTaskAction');
	}

	formatElapsedTime(elapsedTime) {
		let precision = 3;
		var elapsedMilliseconds = elapsedTime[1] / 1000000;
		return elapsedTime[0] + 's ' + elapsedMilliseconds.toFixed(precision) + ' ms';
	}

}

module.exports = BaseTask;

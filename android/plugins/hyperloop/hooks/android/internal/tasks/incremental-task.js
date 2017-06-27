const BaseTask = require('./base-task');
const ChangeManager = require('../monitor/change-manager');
const fs = require('fs-extra');

/**
 * Files based task that is aware of the state of its input and output files and
 * can perform an incremental task run
 */
class IncrementalTask extends BaseTask {

	constructor(taskInfo) {
		super(taskInfo);

		if (!taskInfo.incrementalDirectory) {
			throw new Error('Incremental tasks need an incrementalDirectory specified');
		}
		this._incrementalDirectory = taskInfo.incrementalDirectory;
		fs.ensureDirSync(this.incrementalDirectory);
	}

	/**
	 * Gets the directory where any incremental data will be stored
	 *
	 * @return {string} Full path to the incremental data directory
	 */
	get incrementalDirectory() {
		return this._incrementalDirectory;
	}

	/**
	 * List of directories or files that this task generates
	 *
	 * This is used to determine if the output files of a task were changed
	 *
	 * @return {Array}
	 */
	get incrementalOutputs() {
		return [];
	}

	/**
	 * Checks for changed states of input and output files and starts either a full
	 * or incremental task run
	 *
	 * The rules for this are as follows:
	 *   - No incremental data: full task run
	 *   - Output files changed: full task run
	 *   - Input files changed: incremental task run
	 *   - Nothing changed: skip task run
	 *
	 * @return {Promise}
	 */
	runTaskAction() {
		let changeManager = new ChangeManager();
		let fullBuild = !changeManager.load(this.incrementalDirectory);

		this.inputFiles.forEach(inputPath => {
			changeManager.monitorInputPath(inputPath);
		});

		this.incrementalOutputs.forEach(outputPath => {
			changeManager.monitorOutputPath(outputPath);
		});

		let changedInputFiles = changeManager.getChangedInputFiles();
		let changedOutputFiles = changeManager.getChangedOutputFiles();
		let runPromise;
		if (fullBuild) {
			this._logger.trace(this.name + ': No incremental data, do full task run');
			runPromise = this.doFullTaskRun();
		} else if (changedOutputFiles.size > 0) {
			this._logger.trace(this.name + ': Output files changed, do full task run');
			runPromise = this.doFullTaskRun();
		} else if (changedInputFiles.size > 0) {
			this._logger.trace(this.name + ': Input files changed, do incremental task run');
			runPromise = this.doIncrementalTaskRun(changedInputFiles);
		} else {
			this._logger.trace(this.name + ': Nothing changed, skip task run');
			runPromise = this.loadResultAndSkip();
		}

		return runPromise.then(taskResult => {
			changeManager.updateOutputFiles(this.incrementalOutputs);
			changeManager.write(this.incrementalDirectory);

			return taskResult;
		}).catch((reason) => {
			changeManager.delete(this.incrementalDirectory);
			throw new Error(reason);
		});
	}

	doFullTaskRun() {
		throw new Error('No full task action implemented, override doFullTaskRun');
	}

	doIncrementalTaskRun() {
		throw new Error('No incremental task action implemented, override doIncrementalTaskRun');
	}

	/**
	 * Loads the result of the last task run and skips it
	 *
	 * If no input or output files changed a task will be skiped. Override this if
	 * the task needs to return some JS value after completion. By default a task
	 * has no return value.
	 *
	 * @return {Promise}
	 */
	loadResultAndSkip() {
		return Promise.resolve();
	}

}

module.exports = IncrementalTask;

const fs = require('fs-extra');
const FileStateMonitor = require('./file-state-monitor');
const path = require('path');

const INPUTS_STATE_FILENAME = 'inputs.state';
const OUTPUTS_STATE_FILENAME = 'outputs.state';

/**
 * Manages the state for a set of input and output files usin a file monitor
 */
class ChangeManager {

	/**
	 * Constructs a new change manager
	 */
	constructor() {
		this._inputs = new FileStateMonitor();
		this._outputs = new FileStateMonitor();
	}

	/**
	 * Loads the existing state data from the given path
	 *
	 * @param {string} statePath Full path to the directory containing state data
	 * @return {boolean} Wether the loading was successful or not
	 */
	load(statePath) {
		let inputsStatePathAndFilename = path.join(statePath, INPUTS_STATE_FILENAME);
		let outputsStatePathAndFilename = path.join(statePath, OUTPUTS_STATE_FILENAME);
		if (!fs.existsSync(inputsStatePathAndFilename) || !fs.existsSync(outputsStatePathAndFilename)) {
			return false;
		}
		return this._inputs.load(inputsStatePathAndFilename) && this._outputs.load(outputsStatePathAndFilename);
	}

	/**
	 * Writes the current state data into state files in the given path
	 *
	 * @param {string} statePath Full path to the directory where the state data should be storeds
	 */
	write(statePath) {
		fs.ensureDirSync(statePath);

		this._inputs.write(path.join(statePath, INPUTS_STATE_FILENAME));
		this._outputs.write(path.join(statePath, OUTPUTS_STATE_FILENAME));
	}

	delete(statePath) {
		fs.emptyDirSync(statePath);
	}

	monitorInputPath(pathToMonitor) {
		this._inputs.monitorPath(pathToMonitor);
	}

	monitorOutputPath(pathToMonitor) {
		this._outputs.monitorPath(pathToMonitor);
	}

	hasChanges() {
		return this.getChangedInputFiles().size > 0 || this.getChangedOutputFiles().size > 0;
	}

	getChangedInputFiles() {
		return this._inputs.getChangedFiles();
	}

	getChangedOutputFiles() {
		return this._outputs.getChangedFiles();
	}

	updateOutputFiles(paths) {
		this._outputs.update(paths);
	}

}

module.exports = ChangeManager;

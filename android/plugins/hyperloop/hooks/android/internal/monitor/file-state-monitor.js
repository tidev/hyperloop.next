const fs = require('fs-extra');
const FileState = require('./file-state');
const path = require('path');

const FILE_STATE_NEW = 'new';
const FILE_STATE_CHANGED = 'changed';
const FILE_STATE_REMOVED = 'removed';

/**
 * State monitor for a set of files
 */
class FileStateMonitor {

	/**
	 * Constrcuts a new FileStateManager
	 */
	constructor() {
		/**
		 * Map of the initially loaded files from the state file
		 *
		 * @type {Map}
		 */
		this._loadedFiles = new Map();

		/**
		 * Map containing processed files
		 *
		 * @type {Map}
		 */
		this._processedFiles = new Map();

		/**
		 * Map with state of changed files
		 *
		 * @type {Map}
		 */
		this._changedFiles = new Map();
	}

	/**
	 * Loads cached file state information from a state file
	 *
	 * @param {string} statePathAndFilename Full path to the state file
	 * @return {boolean} True if the state file was loaded successfully, false otherwise
	 */
	load(statePathAndFilename) {
		if (!fs.existsSync(statePathAndFilename)) {
			return false;
		}

		try {
			let stateJson = JSON.parse(fs.readFileSync(statePathAndFilename).toString());
			stateJson.files.forEach(stateEntry => {
				let fileState = new FileState(stateEntry.path, stateEntry.lastModified, stateEntry.size, stateEntry.sha1);
				this._loadedFiles.set(fileState.path, fileState);
			});

			return true;
		} catch (e) {
			// shouldn't happen,
		}

		return false;
	}

	/**
	 * Write the current file states back to disk
	 *
	 * @param {string} statePathAndFilename Fill path to the state file
	 */
	write(statePathAndFilename) {
		let stateData = {
			files: []
		};
		for (let fileState of this._processedFiles.values()) {
			stateData.files.push({
				path: fileState.path,
				lastModified: fileState.lastModified,
				size: fileState.size,
				sha1: fileState.sha1
			});
		}
		fs.ensureDirSync(path.dirname(statePathAndFilename));
		fs.writeFileSync(statePathAndFilename, JSON.stringify(stateData));
	}

	/**
	 * Monitor a new file or directory with this state monitor
	 *
	 * @param {string} pathToMonitor Full path of the file or directory to be monitored
	 */
	monitorPath(pathToMonitor) {
		if (!fs.existsSync(pathToMonitor)) {
			// ignore non-existing paths
			return;
		}

		let stats = fs.lstatSync(pathToMonitor);
		if (stats.isFile()) {
			this.updateFileState(pathToMonitor);
		} else if (stats.isDirectory()) {
			fs.readdirSync(pathToMonitor).forEach(entryName => {
				let fullPath = path.join(pathToMonitor, entryName);
				this.monitorPath(fullPath);
			});
		}
	}

	/**
	 * Detects changes to the file and updates its state
	 *
	 * If the file did not exists in our loaded state before, add it as a new one.
	 * For existing files check wether they have changed and update the file states
	 * map and move them from the loaded map to processed.
	 *
	 * @param {[type]} pathAndFilename [description]
	 * @return {[type]} [description]
	 */
	updateFileState(pathAndFilename) {
		let newFileState = new FileState(pathAndFilename);
		let existingFileState = this._loadedFiles.get(pathAndFilename);
		if (existingFileState === undefined) {
			this._changedFiles.set(pathAndFilename, FILE_STATE_NEW);
			this._processedFiles.set(pathAndFilename, newFileState);
		} else {
			this._loadedFiles.delete(pathAndFilename);
			if (newFileState.isDifferentThan(existingFileState)) {
				this._changedFiles.set(pathAndFilename, FILE_STATE_CHANGED);
				this._processedFiles.set(pathAndFilename, newFileState);
			} else {
				this._processedFiles.set(pathAndFilename, existingFileState);
			}
		}
	}

	update(paths) {
		this._loadedFiles.clear();
		this._processedFiles.forEach((fileState, path) => {
			this._loadedFiles.set(path, fileState);
		});
		this._processedFiles.clear();
		this._changedFiles.clear();
		paths.forEach(path => {
			this.monitorPath(path);
		});
	}

	getChangedFiles() {
		let changedFiles = new Map(this._changedFiles);
		for (let removedFile of this._loadedFiles.values()) {
			changedFiles.set(removedFile.path, FILE_STATE_REMOVED);
		}
		return changedFiles;
	}

}

module.exports = FileStateMonitor;

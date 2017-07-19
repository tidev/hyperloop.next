const crypto = require('crypto');
const fs = require('fs');

/**
 * Represents the current state of a file
 */
class FileState {

  /**
   * Constructs a new file state
   *
   * If only the path is given, the other parameters will be automatically
   * computed.
   *
   * @param {string} path Full path to the file
   * @param {Number} lastModified Last modification time of the file
   * @param {Number} size File size in bytes
   * @param {string} sha1 SHA-1 hash of the file
   */
  constructor(path, lastModified, size, sha1) {
    this._path = path;
    if (arguments.length > 1) {
      this._lastModified = lastModified;
      this._size = size;
      this._sha1 = sha1;
    } else {
      let stat = fs.statSync(path);
      this._lastModified = stat.mtime.getTime();
      this._size = stat.size;
      this._sha1 = null;
    }
  }

  /**
   * Gets the path of the file
   *
   * @return {string} Full file path
   */
  get path() {
    return this._path;
  }

  /**
   * Gets the last modification date of the file
   *
   * @return {Number} Last modified date in miliseconds
   */
  get lastModified() {
    return this._lastModified;
  }

  /**
   * Gets the file size of the file
   *
   * @return {Number} File size in bytes
   */
  get size() {
    return this._size;
  }

  /**
   * Gets the SHA-1 hash of the file's content
   *
   * @return {string} SHA-1 content hash
   */
  get sha1() {
    if (this._sha1 === null) {
      this._sha1 = this.computeSha1();
    }
    return this._sha1;
  }

  /**
   * Computes the sha1 hash of the files content
   *
   * @return {string} Computed sha1 hash
   */
  computeSha1() {
    let hash = crypto.createHash('sha1');
    hash.update(fs.readFileSync(this._path))
    return hash.digest('hex');
  }

  /**
   * Checks if this file state is different than another given file state
   *
   * We do the checks in order of fastest to slowest. First check the
   * modification times, then for different file size and last one is SHA-1
   * content hash.
   *
   * @param {FileState} otherState File state to check against
   * @return {Boolean} True if the two file states are different, false otherwise
   */
  isDifferentThan(otherState) {
    if (this.path !== otherState.path) {
      throw new Error(`Can only compare files with the same path, but tried to compare ${this._path} with ${otherState.path}`);
    }

    if (this.lastModified === otherState.lastModified) {
      return false;
    }

    return this.size !== otherState.size || this.sha1 !== otherState.sha1;
  }

}

module.exports = FileState;

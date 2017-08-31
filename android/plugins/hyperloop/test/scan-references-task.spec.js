const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const expect = chai.expect;
const fs = require('fs');
const mockFs = require('mock-fs');
const path = require('path');
const ScanReferencesTask = require('../hooks/android/tasks/scan-references-task');
const sinon = require('sinon');

const noopBunyanLogger = {
	trace: () => {},
	debug: () => {},
	info: () => {},
	warn: () => {},
	error: () => {},
};
let task = null;
let testReferenceMetadata = {
	usedClasses: [ 'android.app.Activity' ],
	replacedContent: 'require(\'hyperloop/android.app.Activity\');'
};

chai.use(chaiAsPromised);

describe('ScanReferencesTask', () => {

	beforeEach(() => {
		mockFs({
			'incremental': {

			},
			'input': {
				'activity-type.js': 'require("android.app.Activity");',
				'context-type.js': 'require("android.content.Context");',
				'non-existing-type.js': 'require("does.not.exists");',
				'package-require.js': 'require("android.app.*");',
				'non-existing-package.js': 'require("does.not.exists.*");',
				'nested-type.js': 'require("hyperloop.test.NestedClass");'
			},
			'output': {
				'references.json': JSON.stringify({
					[path.join('input', 'activity-type.js')]: testReferenceMetadata
				}),
				'bad_references.json': '{{}InvalidJSON,{[}'
			}
		});
		// Initialize a default task used by most tests. Individual test will override
		// this as needed
		task = new ScanReferencesTask({
			name: 'testScanReferencesTask',
			logger: noopBunyanLogger,
			incrementalDirectory: 'incremental'
		});
		task.outputDirectory = 'output';
		task.metabase = {
			classes: {
				'android.app.Activity': {},
				'android.content.Context': {},
				'hyperloop.test$NestedClass': {}
			}
		};
	});

	afterEach(() => {
		task = null;
		mockFs.restore();
	});

	describe('constructor', () => {
		it('should initialize properties', () => {
			task = new ScanReferencesTask({
				name: 'testScanReferencesTask',
				logger: noopBunyanLogger,
				incrementalDirectory: 'incremental'
			});
			expect(task._referencesPathAndFilename).to.be.null;
			expect(task._references).to.be.a('map');
			expect(task._metabase).to.be.null;
		});
	});

	describe('getter/setter', () => {
		beforeEach(() => {
			task = new ScanReferencesTask({
				name: 'testScanReferencesTask',
				logger: noopBunyanLogger,
				incrementalDirectory: 'incremental'
			});
		});

		describe('outputDirectory', () => {
			it('should set directory and cached references filename', () => {
				let outputPath = 'output';
				task.outputDirectory = outputPath;
				expect(task._outputDirectory).to.be.equal(outputPath);
				expect(task._referencesPathAndFilename).to.be.equal('output/references.json');
			});

			it('should get output directory', () => {
				let outputPath = 'output';
				task._outputDirectory = outputPath;
				expect(task.outputDirectory).to.be.equal(outputPath);
			});
		});

		describe('metabase', () => {
			it('should get metabase object', () => {
				task._metabase = {};
				expect(task.metabase).to.be.an('object');
			});

			it('should set metabase object', () => {
				expect(task._metabase).to.be.null;
				task.metabase = {};
				expect(task._metabase).to.be.an('object');
			});
		});
	});

	describe('doFullTaskRun', () => {
		it('should scan all input files for Hyperloop references', () => {
			task.addInputDirectory('input');

			let scanFileExpectations = sinon.mock(task).expects('scanFileForHyperloopRequires');
			scanFileExpectations.exactly(6);
			return expect(task.doFullTaskRun().then(() => {
				scanFileExpectations.verify();
			})).eventually.be.fulfilled;
		});
	});

	describe('doIncrementalTaskRun', () => {
		it('should do full run if cache file failed to load', () => {
			let loadReferencesStub = sinon.stub(task, 'loadReferences');
			loadReferencesStub.returns(false);
			let fullTaskRunExpectations = sinon.mock(task).expects('doFullTaskRun');
			fullTaskRunExpectations.once();
			fullTaskRunExpectations.resolves();
			return expect(task.doIncrementalTaskRun().then(() => {
				fullTaskRunExpectations.verify();
				loadReferencesStub.restore();
			})).to.eventually.be.fulfilled;
		});

		it('should scan references only for changed files', () => {
			let changedFiles = new Map();
			let activityRequireTestFile = path.join('input', 'activity-type.js');
			let contextRequireTestFile = path.join('input', 'context-type.js');
			changedFiles.set(activityRequireTestFile, 'created');
			changedFiles.set(contextRequireTestFile, 'changed');
			let loadReferencesStub = sinon.stub(task, 'loadReferences');
			loadReferencesStub.returns(true);
			let scanFileExpectations = sinon.mock(task).expects('scanFileForHyperloopRequires');
			scanFileExpectations.twice();
			scanFileExpectations.returns(true);
			return expect(task.doIncrementalTaskRun(changedFiles).then(() => {
				scanFileExpectations.verify();
				expect(scanFileExpectations.firstCall.calledWith(activityRequireTestFile)).to.be.true;
				expect(scanFileExpectations.secondCall.calledWith(contextRequireTestFile)).to.be.true;
			})).to.eventually.be.fulfilled;
		});

		it('should remove old references if file no longer contains Hyperloop references', () => {
			let changedFiles = new Map();
			let testFile = path.join('input', 'activity-type.js');
			changedFiles.set(testFile, 'changed');
			let loadReferencesStub = sinon.stub(task, 'loadReferences');
			loadReferencesStub.returns(true);
			let scanFileExpectations = sinon.mock(task).expects('scanFileForHyperloopRequires');
			scanFileExpectations.once();
			scanFileExpectations.returns(false);
			task._references = new Map();
			task._references.set(testFile, {});
			expect(task.references.size).to.be.equal(1);
			return expect(task.doIncrementalTaskRun(changedFiles).then(() => {
				scanFileExpectations.verify();
				expect(scanFileExpectations.firstCall.calledWith(testFile)).to.be.true;
				expect(task.references).to.be.empty;
			})).to.eventually.be.fulfilled;
		});

		it('should remove deleted files from references', () => {
			let changedFiles = new Map();
			let testFile = path.join('input', 'activity-type.js');
			changedFiles.set(testFile, 'deleted');
			let loadReferencesStub = sinon.stub(task, 'loadReferences');
			loadReferencesStub.returns(true);
			task._references = new Map();
			task._references.set(testFile, {});
			expect(task.references.size).to.be.equal(1);
			return expect(task.doIncrementalTaskRun(changedFiles).then(() => {
				expect(task.references).to.be.empty;
			})).to.eventually.be.fulfilled;
		});
	});

	describe('loadResultAndSkip', () => {
		it('should do full task run if loading references fails', () => {
			let loadReferencesStub = sinon.stub(task, 'loadReferences');
			loadReferencesStub.returns(false);
			let fullTaskRunExpectations = sinon.mock(task).expects('doFullTaskRun');
			fullTaskRunExpectations.once();
			fullTaskRunExpectations.resolves();
			return expect(task.loadResultAndSkip().then(() => {
				fullTaskRunExpectations.verify();
				loadReferencesStub.restore();
			})).to.eventually.be.fulfilled;
		});

		it('should load and set references from file', () => {
			return expect(task.loadResultAndSkip().then(() => {
				expect(task.references.size).to.be.equal(1);
				expect(task.references).to.be.a('map').that.has.key(path.join('input', 'activity-type.js'));
			})).to.eventually.be.fulfilled;
		});
	});

	describe('loadReferences', () => {
		it('should return false if references file does not exist', () => {
			task._referencesPathAndFilename = path.join('output', '_references.json');
			expect(task.loadReferences()).to.be.false;
		});

		it('should return false if parsing reference data fails', () => {
			task._referencesPathAndFilename = path.join('output', 'bad_references.json');
			expect(task.loadReferences()).to.be.false;
		});

		it('should parse json from file and set references', () => {
			expect(task.loadReferences()).to.be.true;
			expect(task.references.size).to.be.equal(1);
			let pathAndFilename = path.join('input', 'activity-type.js');
			expect(task.references).to.be.a('map').that.has.key(pathAndFilename);
			expect(task.references.get(pathAndFilename)).to.be.deep.equal({
				usedClasses: [ 'android.app.Activity' ],
				replacedContent: 'require(\'hyperloop/android.app.Activity\');'
			});
		});
	});

	describe('writeReferences', () => {
		it('should write references to file', () => {
			let pathAndFilename = path.join('input', 'activity-type.js');
			let references = new Map();
			references.set(pathAndFilename, testReferenceMetadata);
			task._references = references;
			task.writeReferences();
			expect(fs.readFileSync(task._referencesPathAndFilename).toString()).to.be.equal(JSON.stringify({ [pathAndFilename]: testReferenceMetadata}));
		});
	});

	describe('scanFileForHyperloopRequires', () => {
		it('should return false if file has no requires to native types', () => {
			expect(task.scanFileForHyperloopRequires(path.join('input', 'non-existing-type.js'))).to.be.false;
		});

		it('should store reference data and return true if file has requires to native types', () => {
			let pathAndFilename = path.join('input', 'activity-type.js');
			expect(task.scanFileForHyperloopRequires(pathAndFilename)).to.be.true;
			expect(task.references.size).to.be.equal(1);
			expect(task.references).to.be.a('map').that.has.key(pathAndFilename);
			expect(task.references.get(pathAndFilename)).to.be.deep.equal(testReferenceMetadata);
		});
	});

	describe('extractAndReplaceHyperloopRequires', () => {
		it('should return null if file does not exist', () => {
			expect(task.extractAndReplaceHyperloopRequires(path.join('input', 'somefile.js'))).to.be.null;
		});

		it('should find and replace wildcard requires of native packages', () => {
			let pathAndFilename = path.join('input', 'package-require.js');
			let result = task.extractAndReplaceHyperloopRequires(pathAndFilename);
			expect(result).to.be.not.null;
			expect(result.usedClasses).to.be.an('array');
			expect(result.usedClasses).to.have.lengthOf(1);
			expect(result.usedClasses).to.include('android.app.Activity');
			expect(result.replacedContent).to.be.equal('require(\'hyperloop/android.app\');');
		});

		it('should ignore requires to non-existing native packages', () => {
			let pathAndFilename = path.join('input', 'non-existing-package.js');
			let result = task.extractAndReplaceHyperloopRequires(pathAndFilename);
			expect(result).to.be.not.null;
			expect(result.usedClasses).to.be.an('array').that.is.empty;
		});

		it('should find and replace requires to native types', () => {
			let pathAndFilename = path.join('input', 'activity-type.js');
			let result = task.extractAndReplaceHyperloopRequires(pathAndFilename);
			expect(result).to.be.not.null;
			expect(result.usedClasses).to.be.an('array');
			expect(result.usedClasses).to.have.lengthOf(1);
			expect(result.usedClasses).to.include('android.app.Activity');
			expect(result.replacedContent).to.be.equal('require(\'hyperloop/android.app.Activity\');');
		});

		it('should ignore requires to non-existing native types ', () => {
			let pathAndFilename = path.join('input', 'non-existing-type.js');
			let result = task.extractAndReplaceHyperloopRequires(pathAndFilename);
			expect(result).to.be.not.null;
			expect(result.usedClasses).to.be.an('array').that.is.empty;
		});

		it('should find and replace nested types', () => {
			let pathAndFilename = path.join('input', 'nested-type.js');
			let result = task.extractAndReplaceHyperloopRequires(pathAndFilename);
			expect(result).to.be.not.null;
			expect(result.usedClasses).to.be.an('array');
			expect(result.usedClasses).to.have.lengthOf(1);
			expect(result.usedClasses).to.include('hyperloop.test$NestedClass');
			expect(result.replacedContent).to.be.equal('require(\'hyperloop/hyperloop.test$NestedClass\');');
		});
	});

	describe('replaceAll', () => {
		it('should replace all occurrences of a string', () => {
			let needle = 'aa';
			let haystack = 'aaabcbaabea';
			let replaceWith = 'z';
			let replacedString = 'zabcbzbea';
			expect(task.replaceAll(haystack, needle, replaceWith)).to.be.equal(replacedString);
		});
	});
});

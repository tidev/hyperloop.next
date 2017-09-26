/* eslint no-unused-expressions: "off" */
'use strict';
const babel = require('babel-core');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const CopySourcesTask = require('../tasks/copy-sources-task');
const expect = chai.expect;
const fs = require('fs-extra');
const minify = require('babel-preset-minify');
const mockFs = require('mock-fs');
const path = require('path');
const sinon = require('sinon');

const noopBunyanLogger = {
	trace: () => {},
	debug: () => {},
	info: () => {},
	warn: () => {},
	error: () => {},
};
let task = null;

chai.use(chaiAsPromised);

function patchBabelAndMockFsLazyRequireIssue() {
	// Babel's minify uses lazy requires which are not compatible with mock-fs, so
	// we first restore the original fs module...
	mockFs.restore();
	// ... and call transfrom once before we reinstanciate mock-fs to resolve
	// lazy requires
	babel.transform('var a = 1;', {
		minified: true,
		compact: true,
		comments: false,
		presets: [ minify ]
	});
	mockFs({
		'incremental': {},
		'input': {
			'file1.js': 'var test = 1;',
			'file2.js': 'var foo = \'bar\';'
		},
		'output': {}
	});
}

describe('CopySourcesTask', () => {

	beforeEach(() => {
		mockFs({
			'incremental': {

			},
			'input': {
				'file1.js': 'var test = 1;',
				'file2.js': 'var foo = \'bar\';'
			},
			'output': {

			}
		});
		task = new CopySourcesTask({
			name: 'testCopySourcesTask',
			logger: noopBunyanLogger,
			incrementalDirectory: 'incremental'
		});
		task.outputDirectory = 'output';
	});

	afterEach(() => {
		task = null;
		mockFs.restore();
	});

	describe('constructor', () => {
		it('should initialize properties', () => {
			task = new CopySourcesTask({
				name: 'testCopySourcesTask',
				logger: noopBunyanLogger,
				incrementalDirectory: 'incremental'
			});
			expect(task._sourceDirectory).to.be.null;
			expect(task._outputDirectory).to.be.null;
			expect(task._builder).to.be.null;
		});
	});

	describe('getter/setter', () => {

	});

	describe('doFullTaskRun', () => {
		it('should copy files when minifyJs is disabled', () => {
			let expectedFile1 = path.join('output', 'file1.js');
			let expectedFile2 = path.join('output', 'file2.js');

			task.sourceDirectory = 'input';
			task.builder = {
				minifyJS: false
			};

			let copySpy = sinon.spy(task, 'copy');

			expect(fs.existsSync(expectedFile1)).to.be.false;
			expect(fs.existsSync(expectedFile2)).to.be.false;
			return expect(task.doFullTaskRun().then(() => {
				expect(fs.existsSync(expectedFile1)).to.be.true;
				expect(fs.existsSync(expectedFile2)).to.be.true;

				expect(copySpy.calledWith(task.sourceDirectory, task.outputDirectory)).to.be.true;
				copySpy.restore();
			})).to.eventually.be.fulfilled;
		});

		it('should minify and copy files when minifyJs is enabled', () => {
			patchBabelAndMockFsLazyRequireIssue();

			let expectedFile1 = path.join('output', 'file1.js');
			let expectedFile2 = path.join('output', 'file2.js');

			task.sourceDirectory = 'input';
			task.builder = {
				minifyJS: true
			};

			let minifySpy = sinon.spy(task, 'minifyJsAndWrite');

			expect(fs.existsSync(expectedFile1)).to.be.false;
			expect(fs.existsSync(expectedFile2)).to.be.false;
			return expect(task.doFullTaskRun().then(() => {
				expect(fs.existsSync(expectedFile1)).to.be.true;
				expect(fs.existsSync(expectedFile2)).to.be.true;
				expect(minifySpy.firstCall.calledWith(path.join('input', 'file1.js'), expectedFile1)).to.be.true;
				expect(minifySpy.secondCall.calledWith(path.join('input', 'file2.js'), expectedFile2)).to.be.true;
				minifySpy.restore();
			})).to.eventually.be.fulfilled;
		});
	});

	describe('doIncrementalTaskRun', () => {
		it('should fallback to full task if deploy type changes', () => {
			let fullRunStub = sinon.stub(task, 'doFullTaskRun');
			fullRunStub.resolves();

			let fakeBuilder = {
				buildManifest: {
					deployType: 'development',
					skipJSMinification: false
				},
				cli: {
					argv: {}
				},
				deployType: 'production'
			};
			task.builder = fakeBuilder;

			return expect(task.doIncrementalTaskRun().then(() => {
				expect(fullRunStub.called).to.be.true;
			})).to.eventually.be.fulfilled;
		});

		it('should fallback to full task if skip-js-minify flag changes', () => {
			let fullRunStub = sinon.stub(task, 'doFullTaskRun');
			fullRunStub.resolves();

			let fakeBuilder = {
				buildManifest: {
					deployType: 'production',
					skipJSMinification: false
				},
				cli: {
					argv: {
						'skip-js-minify': true
					}
				},
				deployType: 'production'
			};
			task.builder = fakeBuilder;

			return expect(task.doIncrementalTaskRun().then(() => {
				expect(fullRunStub.called).to.be.true;
			})).to.eventually.be.fulfilled;
		});

		it('should copy created and changed files when minifyJS is disabled', () => {
			let changedFiles = new Map();
			let changedInputFile = path.join('input', 'file1.js');
			let createdInputFile = path.join('input', 'file2.js');
			changedFiles.set(changedInputFile, 'changed');
			changedFiles.set(createdInputFile, 'created');

			let changedOutputFile = path.join('output', 'file1.js');
			let createdOutputFile = path.join('output', 'file2.js');

			task.sourceDirectory = 'input';
			task.builder = {
				minifyJS: false
			};

			let canDoIncrementalRunStub = sinon.stub(task, 'canDoIncrementalRun');
			canDoIncrementalRunStub.returns(true);

			let copySpy = sinon.spy(task, 'copy');
			return expect(task.doIncrementalTaskRun(changedFiles).then(() => {
				expect(copySpy.firstCall.calledWith(changedInputFile, changedOutputFile)).to.be.true;
				expect(copySpy.secondCall.calledWith(createdInputFile, createdOutputFile)).to.be.true;
				copySpy.restore();
				canDoIncrementalRunStub.restore();
			})).to.eventually.be.fulfilled;
		});

		it('should minify and copy changed and created files when minifyJS is enabled', () => {
			patchBabelAndMockFsLazyRequireIssue();

			let changedFiles = new Map();
			let changedInputFile = path.join('input', 'file1.js');
			let createdInputFile = path.join('input', 'file2.js');
			changedFiles.set(changedInputFile, 'changed');
			changedFiles.set(createdInputFile, 'created');

			let changedOutputFile = path.join('output', 'file1.js');
			let createdOutputFile = path.join('output', 'file2.js');

			task.sourceDirectory = 'input';
			task.builder = {
				minifyJS: true
			};

			let canDoIncrementalRunStub = sinon.stub(task, 'canDoIncrementalRun');
			canDoIncrementalRunStub.returns(true);

			let minifySpy = sinon.spy(task, 'minifyJsAndWrite');
			return expect(task.doIncrementalTaskRun(changedFiles).then(() => {
				expect(minifySpy.firstCall.calledWith(changedInputFile, changedOutputFile)).to.be.true;
				expect(minifySpy.secondCall.calledWith(createdInputFile, createdOutputFile)).to.be.true;
				minifySpy.restore();
				canDoIncrementalRunStub.restore();
			})).to.eventually.be.fulfilled;
		});

		it('should remove deleted files from the output directory', () => {
			let changedFiles = new Map();
			let deletedInputFile = path.join('input', 'file1.js');
			changedFiles.set(deletedInputFile, 'deleted');

			let deletedOutputFile = path.join('output', 'file1.js');

			task.sourceDirectory = 'input';
			task.builder = {
				minifyJS: true
			};

			let canDoIncrementalRunStub = sinon.stub(task, 'canDoIncrementalRun');
			canDoIncrementalRunStub.returns(true);

			let removeSpy = sinon.spy(fs, 'remove');
			return expect(task.doIncrementalTaskRun(changedFiles).then(() => {
				expect(removeSpy.firstCall.calledWith(deletedOutputFile)).to.be.true;
				removeSpy.restore();
				canDoIncrementalRunStub.restore();
			})).to.eventually.be.fulfilled;
		});
	});

});

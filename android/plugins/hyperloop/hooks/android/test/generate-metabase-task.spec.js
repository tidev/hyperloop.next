/* eslint no-unused-expressions: "off" */
'use strict';
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const expect = chai.expect;
const GenerateMetabaseTask = require('../tasks/generate-metabase-task');
const metabase = require('../metabase');
const mockFs = require('mock-fs');
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

describe('GenerateMetabaseTask', () => {

	beforeEach(() => {
		task = new GenerateMetabaseTask({
			name: 'testGenerateMetabaseTask',
			logger: noopBunyanLogger
		});
	});

	afterEach(() => {
		task = null;
	});

	describe('constructor', () => {
		it('should set properties to null', () => {
			expect(task._builder).to.be.null;
			expect(task._metabase).to.be.null;
		});
	});

	describe('runTaskAction', () => {

		let dummyBuilder = {
			realTargetSDK: 23
		};

		beforeEach(() => {
			mockFs({
				'dummy.jar': ''
			});
		});

		afterEach(() => {
			mockFs.restore();
		});

		it('should call through to metabase generator', () => {
			let emptyDummyMetabase = {};
			let metabaseMock = sinon.mock(metabase.metabase);
			let loadMetabaseExpectations = metabaseMock.expects('loadMetabase');
			loadMetabaseExpectations.withArgs([ 'dummy.jar' ], { platform: `android-${dummyBuilder.realTargetSDK}` });
			loadMetabaseExpectations.callsArgWith(2, null, emptyDummyMetabase);
			task.builder = dummyBuilder;
			task.addInputFile('dummy.jar');
			return expect(task.runTaskAction().then(() => {
				metabaseMock.verify();
				expect(task._metabase).to.be.an('object');
				mockFs.restore();
			})).to.eventually.be.fulfilled;
		});

		it('should pass through error if metabase genration failed', () => {
			let testError = new Error('Metabase generation failed!');
			let loadMetabaseStub = sinon.stub(metabase.metabase, 'loadMetabase');
			loadMetabaseStub.callsArgWith(2, testError);
			task.builder = dummyBuilder;
			task.addInputFile('dummy.jar');
			return expect(task.runTaskAction()).to.eventually.be.rejectedWith(testError).then(() => {
				loadMetabaseStub.restore();
			});
		});
	});
});

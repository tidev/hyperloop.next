const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const expect = chai.expect;
const fs = require('fs');
const GenerateSourcesTask = require('../tasks/generate-sources-task');
const metabase = require('../metabase');
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

describe('GenerateSourcesTask', () => {

	beforeEach(() => {
		mockFs({
			'incremental': {
				'classes.json': JSON.stringify(['android.app.Activity', 'android.content.Context']),
				'bad_classes.json': '{{}InvalidJSON,{[}'
			},
			'output': {
				'android.content.Context.js': ''
			}
		});
		task = new GenerateSourcesTask({
			name: 'testGenerateSourcesTask',
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
			expect(task._references).to.be.null;
			expect(task._metabase).to.be.null;
			expect(task._classListPathAndFilename).to.be.equal(path.join('incremental', 'classes.json'));
			expect(task._generatedClasses).to.be.a('set').that.is.empty;
		});
	});

	describe('getter/setter', () => {

	});

	describe('doFullTaskRun', () => {
		it('should skip if no references found', () => {
			let generateSourcesSpy = sinon.spy(task, 'generateSources');
			task.references = new Map();
			return expect(task.doFullTaskRun().then(() => {
				expect(generateSourcesSpy.called).to.be.false;
			}));
		});

		it('should generate sources for all referenced classes including dependencies', () => {
			let testReferences = new Map();
			let usedClasses = ['android.app.Activity', 'android.content.Context'];
			let classesToGenerate = usedClasses.concat(['android.view.View']);
			testReferences.set('file1.js', {
				usedClasses: usedClasses
			});
			task.references = testReferences;

			let expandDependenciesStub = sinon.stub(metabase.generate, 'expandDependencies');
			expandDependenciesStub.returns(classesToGenerate);

			let generateSourcesStub = sinon.stub(task, 'generateSources');
			generateSourcesStub.resolves();

			return expect(task.doFullTaskRun().then(() => {
				expect(task._generatedClasses).to.be.a('set').that.has.all.keys(classesToGenerate);
				expect(generateSourcesStub.calledWith(classesToGenerate)).to.be.true;
				expandDependenciesStub.restore();
				generateSourcesStub.restore();
			})).to.eventually.be.fulfilled;
		});
	});

	describe('doIncrementalTaskRun', () => {
		it('should fallback to full run if old class list failed to load', () => {
			let loadClassListStub = sinon.stub(task, 'loadClassList');
			loadClassListStub.returns(false);

			let taskMock = sinon.mock(task);
			let doFullTaskRunExpectation = taskMock.expects('doFullTaskRun');
			doFullTaskRunExpectation.once();
			doFullTaskRunExpectation.resolves();

			return expect(task.doIncrementalTaskRun().then(() => {
				taskMock.verify();
			})).to.eventually.be.fulfilled;
		});

		it('should generate wrappers for newly referenced types', () => {
			let loadClassListStub = sinon.stub(task, 'loadClassList');
			loadClassListStub.returns(true);

			let expandDependenciesStub = sinon.stub(metabase.generate, 'expandDependencies');
			expandDependenciesStub.returns(['android.app.Activity', 'android.content.Context']);

			let taskMock = sinon.mock(task);
			let generateSourcesExpectation = taskMock.expects('generateSources');
			generateSourcesExpectation.once().withArgs(['android.content.Context'], []).resolves();

			task.references = new Map();
			task.references.set('dummy1.js', {
				usedClasses: ['android.app.Activity']
			});
			task.references.set('dummy2.js', {
				usedClasses: ['android.content.Context']
			});
			task.metabase = {};
			task._generatedClasses = new Set(['android.app.Activity']);

			return expect(task.doIncrementalTaskRun().then(() => {
				taskMock.verify();
				expandDependenciesStub.restore();
			})).to.eventually.be.fulfilled;
		});

		it('should remove existing wrappers for types that are not referenced anymore', () => {
			let expandDependenciesStub = sinon.stub(metabase.generate, 'expandDependencies');
			expandDependenciesStub.returns(['android.app.Activity']);

			let taskMock = sinon.mock(task);
			let generateSourcesExpectation = taskMock.expects('generateSources');
			generateSourcesExpectation.once().withArgs([], ['android.content.Context']).resolves();

			task.references = new Map();
			task.references.set('dummy1.js', {
				usedClasses: ['android.app.Activity']
			});
			task.metabase = {};

			return expect(task.doIncrementalTaskRun().then(() => {
				taskMock.verify();
				expandDependenciesStub.restore();
			})).to.eventually.be.fulfilled;
		});
	});

	describe('generateSources', () => {
		it('should skip if no update required', () => {
			let metabaseGenerateSpy = sinon.spy(metabase.generate, 'generateFromJSON');
			return expect(task.generateSources([], []).then(() => {
				expect(metabaseGenerateSpy.called).to.be.false;
				metabaseGenerateSpy.restore();
			})).to.eventually.be.fulfilled;
		});

		it('should prepare options and pass through to metabase code generation', () => {
			let classesToGenerate = ['android.app.Activity'];
			let removedClasses = ['android.content.Context'];
			let existingClasses = ['android.content.Context'];
			let expectedOptions = {
				classesToGenerate,
				removedClasses,
				existingClasses
			};

			let metabaseGenerateMock = sinon.mock(metabase.generate);
			let generateExpectations = metabaseGenerateMock.expects('generateFromJSON');
			generateExpectations.once().withArgs(task.outputDirectory, {}, expectedOptions);
			generateExpectations.callsArgWith(3, null, classesToGenerate);

			task.metabase = {};
			task._generatedClasses = new Set(existingClasses);

			return expect(task.generateSources(classesToGenerate, removedClasses).then(() => {
				metabaseGenerateMock.verify();
			})).to.eventually.be.fulfilled;
		});
	});

	describe('loadClassList', () => {
		it('should return false if class list does not exist', () => {
			task._classListPathAndFilename = path.join('incremental', '_classes.json');
			expect(task.loadClassList()).to.be.false;
			expect(task._generatedClasses.size).to.be.equal(0);
		});

		it('should return false if existing class list failed to load', () => {
			task._classListPathAndFilename = path.join('incremental', 'bad_classes.json');
			expect(task.loadClassList()).to.be.false;
			expect(task._generatedClasses.size).to.be.equal(0);
		});

		it('should load and set existing class list', () => {
			expect(task.loadClassList()).to.be.true;
			expect(task._generatedClasses).to.be.a('set').that.has.all.keys(['android.app.Activity', 'android.content.Context']);
		});
	});

	describe('writeClassList', () => {
		it('should write generated class list to file', () => {
			let generatedClasses = ['android.app.Activity', 'android.content.Context'];
			task._generatedClasses = new Set(generatedClasses);

			fs.unlinkSync(task._classListPathAndFilename);
			expect(fs.existsSync(task._classListPathAndFilename)).to.be.false;
			return expect(task.writeClassList().then(() => {
				expect(fs.existsSync(task._classListPathAndFilename)).to.be.true;
				expect(fs.readFileSync(task._classListPathAndFilename).toString()).to.be.equal(JSON.stringify(generatedClasses));
			})).to.eventually.be.fulfilled;
		});

		it.skip('should reject with error if write failed', () => {
			let generatedClasses = ['android.app.Activity', 'android.content.Context'];
			task._generatedClasses = new Set(generatedClasses);

			let writeError = new Error('Write failed');
			let writeFileStub = sinon.stub(fs, 'writeFile');
			writeFileStub.callsArgWith(2, writeError);

			fs.unlinkSync(task._classListPathAndFilename);
			expect(fs.existsSync(task._classListPathAndFilename)).to.be.false;
			return expect(task.writeClassList()).to.eventually.be.rejectedWith(writeError)
				.then(() => {
					writeFileStub.restore();
				});
		});
	});

});

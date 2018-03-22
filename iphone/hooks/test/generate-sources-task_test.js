/* eslint-env node, mocha */
/* eslint no-unused-expressions: "off", security/detect-non-literal-require: "off" */
'use strict';

const should = require('should'),
	gencustom = require('../generate/custom'),
	hm = require('hyperloop-metabase'),
	SDKEnvironment = hm.SDKEnvironment,
	util = require('../generate/util'),
	nodePath = require('path'),
	buildDir = nodePath.join(__dirname, '..', 'tmp', 'hyperloop');

const GenerateSourcesTask = require('../tasks/generate-sources-task');
const noopBunyanLogger = {
	trace: () => { },
	debug: () => { },
	info: () => { },
	warn: () => { },
	error: () => { },
};

function Hyperloop () {
}

Hyperloop.prototype.toJSON = function () {
	return '[Hyperloop ' + this.name + ']';
};

Hyperloop.prototype.inspect = function () {
	return '[Hyperloop ' + this.name + ']';
};

Hyperloop.getWrapper = function () {
};

Hyperloop.registerWrapper = function () {
};

function HyperloopObject (pointer) {
	this.pointer = pointer;
	this.name = pointer.name || pointer.className;
}

HyperloopObject.prototype.toJSON = function () {
	return '[HyperloopObject ' + this.pointer + ']';
};

HyperloopObject.prototype.inspect = function () {
	return '[HyperloopObject ' + this.pointer + ']';
};

function HyperloopProxy (n, c) {
	this.$native = n;
	this.$classname = c;
	this.name = c;
}

HyperloopProxy.prototype.toJSON = function () {
	return '[HyperloopProxy ' + this.$native + ']';
};

HyperloopProxy.prototype.inspect = function () {
	return '[HyperloopProxy ' + this.$native + ']';
};

describe('GenerateSourcesTask', function () {
	let sdk;
	this.timeout(10000);

	function generateStub(frameworkName, className, cb) {
		let frameworks;
		SDKEnvironment.fromTypeAndMinimumVersion('iphonesimulator', '9.0')
			.then(sdkInfo => {
				sdk = sdkInfo;
				return sdk.getSystemFrameworks();
			})
			.then(frameworkMap => {
				should(frameworkMap).be.ok;
				frameworkMap.has('$metadata').should.be.false;
				frameworks = frameworkMap;

				const frameworksToGenerate = [ frameworkName ];
				return hm.unifiedMetabase(sdk, frameworkMap, frameworksToGenerate);
			})
			.then((metabase) => {
				const state = new gencustom.ParserState();
				const references = [ 'hyperloop/' + frameworkName.toLowerCase() + '/' + className.toLowerCase() ];
				GenerateSourcesTask.generateSources(buildDir, 'TestApp', metabase, state, frameworks, references, noopBunyanLogger, cb);
			})
			.catch(err => cb(err));
	}

	afterEach(() => {
		Hyperloop.$invocations = null;
		delete global.Hyperloop;
		delete global.HyperloopObject;
	});

	beforeEach(() => {
		global.Hyperloop = Hyperloop;
		global.HyperloopObject = HyperloopObject;

		// fs.emptyDirSync(buildDir);
	});

	before(function () {
		let proxyCount = 0;
		const Module = require('module').Module;
		const old_nodeModulePaths = Module._nodeModulePaths;
		const appModulePaths = [];

		util.setLog({
			trace: function () {},
			debug: function () {},
			info: function () {},
			warn: function () {}
		});

		// borrowed from https://github.com/patrick-steele-idem/app-module-path-node/blob/master/lib/index.js
		Module._nodeModulePaths = function (from) {
			let paths = old_nodeModulePaths.call(this, from);

			// Only include the app module path for top-level modules
			// that were not installed:
			if (from.indexOf('node_modules') === -1) {
				paths = appModulePaths.concat(paths);
			}

			return paths;
		};

		function addPath (path) {
			function addPathHelper(targetArray) {
				path = nodePath.normalize(path);
				if (targetArray && targetArray.indexOf(path) === -1) {
					targetArray.unshift(path);
				}
			}

			let parent;
			path = nodePath.normalize(path);

			if (appModulePaths.indexOf(path) === -1) {
				appModulePaths.push(path);
				// Enable the search path for the current top-level module
				addPathHelper(require.main.paths);
				parent = module.parent;

				// Also modify the paths of the module that was used to load the app-module-paths module
				// and all of it's parents
				while (parent && parent !== require.main) {
					addPathHelper(parent.paths);
					parent = parent.parent;
				}
			}
		}

		Hyperloop.dispatch = function (native, selector, args, instance) {
			if (!native) {
				throw new Error('dispatch called without a native object');
			}
			instance = instance === undefined ? true : instance;
			// console.log('dispatch', (instance ? '-' : '+') + '[' + (native.name || native.className) + ' ' + selector + ']');
			Hyperloop.$invocations = Hyperloop.$invocations || [];
			// console.log('dispatch native', typeof(native), native, native.name);
			Hyperloop.$invocations.push({
				method: 'dispatch',
				args: [ native, selector, args, instance ]
			});
			Hyperloop.$last = Hyperloop.$invocations[Hyperloop.$invocations.length - 1];
			return Hyperloop.$dispatchResult;
		};

		Hyperloop.createProxy = function (opts) {
			// console.log('createProxy', opts);
			Hyperloop.$invocations = Hyperloop.$invocations || [];
			Hyperloop.$invocations.push({
				method: 'createProxy',
				args: Array.prototype.slice.call(arguments)
			});
			Hyperloop.$last = Hyperloop.$invocations[Hyperloop.$invocations.length - 1];
			return new HyperloopProxy(proxyCount++, opts.class);
		};

		// setup the node path to resolve files that we generated
		addPath(nodePath.dirname(buildDir));

		const originalRequire = Module.prototype.require;
		Module.prototype.require = function (path) {
			if (/^\/hyperloop/.test(path)) {
				path = path.slice(1);
			}
			return originalRequire.call(this, path);
		};
	});

	it('should generate UIView', done => {
		generateStub('UIKit', 'UIView', err => {
			should(err).not.be.ok;
			const UIView = require(nodePath.join(buildDir, 'uikit/uiview.js'));
			should(UIView).be.a.function;
			const view = new UIView();
			should(view).be.an.object;
			should(UIView.name).be.equal('UIView');
			should(UIView.new).be.a.function;
			should(view.className).be.equal('UIView');
			should(view.$native).be.an.object;
			done();
		});
	});

	it('should generate NSString', done => {
		generateStub('Foundation', 'NSString', err => {
			should(err).not.be.ok;
			const NSString = require(nodePath.join(buildDir, 'foundation/nsstring.js'));
			should(NSString).be.a.function;
			const view = new NSString();
			should(view).be.an.object;
			should(NSString.name).be.equal('NSString');
			should(NSString.new).be.a.function;
			should(view.className).be.equal('NSString');
			should(view.$native).be.an.object;
			done();
		});
	});

	it('should generate UILabel', done => {
		generateStub('UIKit', 'UILabel', err => {
			should(err).not.be.ok;
			const UILabel = require(nodePath.join(buildDir, 'uikit/uilabel.js'));
			should(UILabel).be.a.function;
			const label = new UILabel();
			should(label).be.an.object;
			should(UILabel.name).be.equal('UILabel');
			should(UILabel.new).be.a.function;
			should(label.className).be.equal('UILabel');
			should(label.$native).be.an.object;
			label.setText('hello');
			should(Hyperloop.$last).be.eql({
				method: 'dispatch',
				args: [
					label.$native,
					'setText:',
					[ 'hello' ],
					true
				]
			});
			done();
		});
	});

	it('should generate UIControlState (enum)', done => {
		generateStub('UIKit', 'UIControlState', err => {
			should(err).not.be.ok;
			const UIControlState = require(nodePath.join(buildDir, 'uikit/uicontrolstate.js'));
			should(UIControlState).be.an.object;
			should(UIControlState.Normal).be.a.number;
			should(UIControlState.Normal).eql(0);
			should(UIControlState.Highlighted).be.a.number;
			should(UIControlState.Highlighted).eql(1);
			should(UIControlState.Disabled).be.a.number;
			should(UIControlState.Disabled).eql(2);
			should(UIControlState.Selected).be.a.number;
			should(UIControlState.Selected).eql(4);
			should(UIControlState.Focused).be.a.number;
			should(UIControlState.Focused).eql(8);
			done();
		});
	});

	it('should always generate Foundation', done => {
		generateStub('Intents', 'INPreferences', err => {
			should(err).not.be.ok;
			// Check some Foundation basics...
			const Foundation = require(nodePath.join(buildDir, 'foundation/foundation.js'));
			should(Foundation).be.a.function;
			should(Foundation.NSUTF8StringEncoding).be.a.number;
			const NSString = require(nodePath.join(buildDir, 'foundation/nsstring.js'));
			should(NSString).be.a.function;
			should(NSString.name).be.equal('NSString');
			const instance = new NSString();
			should(instance).be.an.object;
			should(instance.className).be.equal('NSString');
			should(instance.$native).be.an.object;

			// ... and if INPreferences is generated correctly, which does not work without
			// explicitly including Foundation framework
			const INPreferences = require(nodePath.join(buildDir, 'intents/inpreferences.js'));
			should(INPreferences).be.a.function;
			should(INPreferences.siriAuthorizationStatus).be.a.function;
			done();
		});
	});
});

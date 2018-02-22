/* eslint-env node, mocha */
/* eslint no-unused-expressions: "off", security/detect-non-literal-require: "off" */
'use strict';

const should = require('should'),
	gencustom = require('../generate/custom'),
	fs = require('fs-extra'),
	hm = require('hyperloop-metabase'),
	generator = require('../generate/index'),
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

	this.timeout(10000);

	function generateStub(frameworkName, className, cb) {
		hm.frameworks.getSDKPath('iphonesimulator', (err, sdkPath) => {
			// FIXME This should really test the same workflow we use in the hook!
			hm.frameworks.getSystemFrameworks(buildDir, sdkPath, function (err, frameworkMap) {
				should(err).not.be.ok;
				should(frameworkMap).be.ok;
				frameworkMap.has('$metadata').should.be.false;

				const state = new gencustom.ParserState();
				const minVersion = '9.0';
				const frameworksToGenerate = [ frameworkName ];
				hm.metabase.unifiedMetabase(buildDir, sdkPath, minVersion, frameworkMap, frameworksToGenerate, (err, metabase) => {
					should(err).not.be.ok;

					const references = [ 'hyperloop/' + frameworkName.toLowerCase() + '/' + className.toLowerCase() ];
					GenerateSourcesTask.generateSources(buildDir, 'TestApp', metabase, state, frameworkMap, references, noopBunyanLogger, cb);
				});
			});
		});
	}

	afterEach(function () {
		Hyperloop.$invocations = null;
		delete global.Hyperloop;
		delete global.HyperloopObject;
	});

	beforeEach(function () {
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

	it('should generate UIView', function (done) {
		generateStub('UIKit', 'UIView', function (err) {
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

	it('should generate NSString', function (done) {
		generateStub('Foundation', 'NSString', function (err) {
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

	it('should generate UILabel', function (done) {
		generateStub('UIKit', 'UILabel', function (err) {
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

	// it('should always generate Foundation', function (done) {
	// 	const includes = [
	// 		'<Intents/INPreferences.h>'
	// 	];
	// 	generateStub(includes, 'Intents/INPreferences', function (err) {
	// 		should(err).not.be.ok;
	// 		// Check some Foundation basics...
	// 		const Foundation = require(nodePath.join(buildDir, 'foundation/foundation.js'));
	// 		should(Foundation).be.a.function;
	// 		should(Foundation.NSUTF8StringEncoding).be.a.number;
	// 		const NSString = require(nodePath.join(buildDir, 'foundation/nsstring.js'));
	// 		should(NSString).be.a.function;
	// 		should(NSString.name).be.equal('NSString');
	// 		const instance = new NSString();
	// 		should(instance).be.an.object;
	// 		should(instance.className).be.equal('NSString');
	// 		should(instance.$native).be.an.object;
	//
	// 		// ... and if INPreferences is generated correctly, which does not work without
	// 		// explicitly including Foundation framework
	// 		const INPreferences = require(nodePath.join(buildDir, 'intents/inpreferences.js'));
	// 		should(INPreferences).be.a.function;
	// 		should(INPreferences.siriAuthorizationStatus).be.a.function;
	// 		done();
	// 	});
	// });
});

/* eslint-disable no-unused-expressions */
'use strict';

const should = require('should'),
	gencustom = require('../generate/custom'),
	fs = require('fs-extra'),
	metabase = require('hyperloop-metabase').metabase,
	generator = require('../generate/index'),
	util = require('../generate/util'),
	nodePath = require('path'),
	buildDir = nodePath.join(__dirname, '..', 'tmp', 'hyperloop');

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

describe('generate', function () {

	this.timeout(10000);

	function generateStub(includes, className, cb) {
		metabase.getSystemFrameworks(buildDir, 'iphonesimulator', '9.0', function (err, frameworkMap) {
			metabase.generateMetabase(buildDir, frameworkMap.get('$metadata').sdkType, frameworkMap.get('$metadata').sdkPath, frameworkMap.get('$metadata').minVersion, includes, false, function (err, json) {
				should(err).not.be.ok;
				should(json).be.ok;
				const state = new gencustom.ParserState();

				generator.generateFromJSON('TestApp', json, state, function (err, sourceSet, modules) {
					if (err) {
						return cb(err);
					}

					const codeGenerator = new generator.CodeGenerator(sourceSet, modules, {
						parserState: state,
						metabase: json,
						references: [ 'hyperloop/' + className.toLowerCase() ],
						frameworks: frameworkMap
					});
					codeGenerator.generate(buildDir);

					cb();
				}, []);
			}, true);
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

		fs.emptyDirSync(buildDir);
	});

	before(function () {
		var proxyCount = 0;
		var Module = require('module').Module;
		var old_nodeModulePaths = Module._nodeModulePaths;
		var appModulePaths = [];

		util.setLog({
			trace: function () {},
			debug: function () {},
			info: function () {},
			warn: function () {}
		});

		// borrowed from https://github.com/patrick-steele-idem/app-module-path-node/blob/master/lib/index.js
		Module._nodeModulePaths = function (from) {
			var paths = old_nodeModulePaths.call(this, from);

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

			var parent;
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

		var originalRequire = Module.prototype.require;
		Module.prototype.require = function (path) {
			if (/^\/hyperloop/.test(path)) {
				path = path.slice(1);
			}
			return originalRequire.call(this, path);
		};
	});

	it('should generate UIView', function (done) {
		var includes = [
			'UIKit/UIView.h'
		];
		generateStub(includes, 'UIKit/UIView', function (err) {
			should(err).not.be.ok;
			var UIView = require(nodePath.join(buildDir, 'uikit/uiview.js'));
			should(UIView).be.a.function;
			var view = new UIView();
			should(view).be.an.object;
			should(UIView.name).be.equal('UIView');
			should(UIView.new).be.a.function;
			should(view.className).be.equal('UIView');
			should(view.$native).be.an.object;
			done();
		});
	});

	it('should generate NSString', function (done) {
		var includes = [
			'Foundation/NSString.h'
		];
		generateStub(includes, 'Foundation/NSString', function (err) {
			should(err).not.be.ok;
			var NSString = require(nodePath.join(buildDir, 'foundation/nsstring.js'));
			should(NSString).be.a.function;
			var view = new NSString();
			should(view).be.an.object;
			should(NSString.name).be.equal('NSString');
			should(NSString.new).be.a.function;
			should(view.className).be.equal('NSString');
			should(view.$native).be.an.object;
			done();
		});
	});

	it('should generate UILabel', function (done) {
		var includes = [
			'UIKit/UILabel.h'
		];
		generateStub(includes, 'UIKit/UILabel', function (err) {
			should(err).not.be.ok;
			var UILabel = require(nodePath.join(buildDir, 'uikit/uilabel.js'));
			should(UILabel).be.a.function;
			var label = new UILabel();
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

	it('should always generate Foundation', function (done) {
		var includes = [
			'<Intents/INPreferences.h>'
		];
		generateStub(includes, 'Intents/INPreferences', function (err) {
			should(err).not.be.ok;
			// Check some Foundation basics...
			var Foundation = require(nodePath.join(buildDir, 'foundation/foundation.js'));
			should(Foundation).be.a.function;
			should(Foundation.NSUTF8StringEncoding).be.a.number;
			var NSString = require(nodePath.join(buildDir, 'foundation/nsstring.js'));
			should(NSString).be.a.function;
			should(NSString.name).be.equal('NSString');
			var instance = new NSString();
			should(instance).be.an.object;
			should(instance.className).be.equal('NSString');
			should(instance.$native).be.an.object;

			// ... and if INPreferences is generated correctly, which does not work without
			// explicitly including Foundation framework
			var INPreferences = require(nodePath.join(buildDir, 'intents/inpreferences.js'));
			should(INPreferences).be.a.function;
			should(INPreferences.siriAuthorizationStatus).be.a.function;
			done();
		});
	});
});

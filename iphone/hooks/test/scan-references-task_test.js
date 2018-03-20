/* eslint-env node, mocha */
/* eslint no-unused-expressions: "off" */
'use strict';

const should = require('should'), // eslint-disable-line no-unused-vars
	SDKEnvironment = require('hyperloop-metabase').SDKEnvironment,
	nodePath = require('path'),
	buildDir = nodePath.join(__dirname, '..', 'tmp', 'hyperloop');

const ScanReferencesTask = require('../tasks/scan-references-task');
const noopBunyanLogger = {
	trace: () => { },
	debug: () => { },
	info: () => { },
	warn: () => { },
	error: () => { },
};

describe('ScanReferencesTask', function () {
	let frameworks = new Map();
	let sdk;

	this.timeout(10000);

	before(done => {
		SDKEnvironment.fromTypeAndMinimumVersion('iphonesimulator', '9.0')
			.then(sdkInfo => {
				sdk = sdkInfo;
				return sdk.getSystemFrameworks();
			})
			.then(frameworkMap => {
				frameworks = frameworkMap;
				done();
			})
			.catch(err => done(err));
	});

	it('can find specific types in basic require calls', () => {
		const result = ScanReferencesTask.scanForReferences('require("UIKit/UILabel");', 'app.js', frameworks, buildDir, sdk, noopBunyanLogger);
		result.should.be.ok;
		result.references.has('UIKit').should.be.true;
		result.references.get('UIKit').should.containEql('UILabel');
		result.replacedContent.should.eql('require("/hyperloop/uikit/uilabel");');
	});

	// FIXME: This is broken!
	// it('can find framework umbrella reference in basic require call', () => {
	// 	const result = ScanReferencesTask.scanForReferences('require("UIKit");', 'app.js', frameworks, buildDir, sdk, noopBunyanLogger);
	// 	result.should.be.ok;
	// 	result.references.has('UIKit').should.be.true;
	// 	result.references.get('UIKit').should.containEql('UIKit');
	// 	result.replacedContent.should.eql('require("/hyperloop/uikit/uikit");');
	// });

	it('can find builtin types in basic require calls', () => {
		const result = ScanReferencesTask.scanForReferences('require("Titanium/TiApp");', 'app.js', frameworks, buildDir, sdk, noopBunyanLogger);
		result.should.be.ok;
		result.references.has('Titanium').should.be.true;
		result.references.get('Titanium').should.containEql('TiApp');
		result.replacedContent.should.eql('require("/hyperloop/titanium/tiapp");');
	});

	it('can find native types using es6 import with default export usage of exact type module name', () => {
		const result = ScanReferencesTask.scanForReferences('import UIView from "UIKit/UIView";', 'app.js', frameworks, buildDir, sdk, noopBunyanLogger);
		result.should.be.ok;
		result.references.has('UIKit').should.be.true;
		result.references.get('UIKit').should.containEql('UIView');
		result.replacedContent.should.eql('import UIView from "/hyperloop/uikit/uiview";');
	});

	// FIXME: The * as import is meant to import the whole list of exports as a single aliased namespace. For a type, what would that be?
	// For a framework what would that be? Probably means we can import 'UIKit' and it assumes we could use any type hanging off the alias name.
	// I don't really see how it'd differ much from the "import Name from 'mod-name';" variant.
	it.skip('can find native types using es6 import with aliased export usage of exact type module name', () => { // eslint-disable-line
		const result = ScanReferencesTask.scanForReferences('import * as OtherName from "UIKit/UIView";', 'app.js', frameworks, buildDir, sdk, noopBunyanLogger);
		result.should.be.ok;
		result.references.has('UIKit').should.be.true;
		result.references.get('UIKit').should.containEql('UIView');
		result.replacedContent.should.eql('import * as OtherName from "/hyperloop/uikit/uiview";');
	});

	it('can find native types using es6 import of framework with class as specifier', () => {
		const result = ScanReferencesTask.scanForReferences('import { UIView } from "UIKit"', 'app.js', frameworks, buildDir, sdk, noopBunyanLogger);
		result.should.be.ok;
		result.references.has('UIKit').should.be.true;
		result.references.get('UIKit').should.containEql('UIView');
		result.replacedContent.should.eql('import UIView from "/hyperloop/uikit/uiview";');
	});

	it('can find native types using es6 import of framework with enum as specifier', () => {
		const result = ScanReferencesTask.scanForReferences('import { UIControlState } from "UIKit"', 'app.js', frameworks, buildDir, sdk, noopBunyanLogger);
		result.should.be.ok;
		result.references.has('UIKit').should.be.true;
		result.references.get('UIKit').should.containEql('UIControlState');
		result.replacedContent.should.eql('import UIControlState from "/hyperloop/uikit/uicontrolstate";');
	});
});

/* eslint-env node, mocha */
/* eslint no-unused-expressions: "off" */
'use strict';

const should = require('should'), // eslint-disable-line no-unused-vars
	hm = require('hyperloop-metabase'),
	nodePath = require('path'),
	buildDir = nodePath.join(__dirname, '..', 'tmp', 'hyperloop');

const GenerateMetabaseTask = require('../tasks/generate-metabase-task');
const noopBunyanLogger = {
	trace: () => { },
	debug: () => { },
	info: () => { },
	warn: () => { },
	error: () => { },
};

describe('GenerateMetabaseTask', function () {
	let frameworks = new Map();
	let sdkPath;
	const minVersion = '9.0';
	const sdkType = 'iphonesimulator';

	this.timeout(10000);

	before(done => {
		hm.frameworks.getSDKPath(sdkType, (err, foundSDKPath) => {
			if (err) {
				return done(err);
			}
			hm.frameworks.getSystemFrameworks(buildDir, foundSDKPath, function (err, frameworkMap) {
				if (err) {
					return done(err);
				}
				frameworks = frameworkMap;
				sdkPath = foundSDKPath;
				done();
			});
		});
	});

	it('generates a unified metabase from list of explicitly used frameworks', (done) => {
		GenerateMetabaseTask.generateMetabase(buildDir, sdkPath, minVersion, sdkType, frameworks, [ 'UIKit' ], [], noopBunyanLogger, (err, metabase) => {
			// TODO Verify that we have a unified metabase that has all dependencies!
			should(err).not.be.ok;
			metabase.should.be.ok;

			metabase.should.have.property('classes');
			metabase.classes.should.have.property('UILabel'); // from UIKit, which we explicitly stated as a used framework
			metabase.classes.should.have.property('NSObject'); // from Foundation

			done();
		});
	});
});

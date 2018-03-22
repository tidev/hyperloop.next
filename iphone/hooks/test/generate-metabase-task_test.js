/* eslint-env node, mocha */
/* eslint no-unused-expressions: "off" */
'use strict';

const should = require('should'); // eslint-disable-line no-unused-vars
const SDKEnvironment = require('hyperloop-metabase').SDKEnvironment;
const nodePath = require('path');
const buildDir = nodePath.join(__dirname, '..', 'tmp', 'hyperloop');

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
	let sdk;
	const minVersion = '9.0';
	const sdkType = 'iphonesimulator';

	this.timeout(10000);

	before(done => {
		SDKEnvironment.fromTypeAndMinimumVersion(sdkType, minVersion)
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

	it('generates a unified metabase from list of explicitly used frameworks', done => {
		GenerateMetabaseTask.generateMetabase(sdk, frameworks, [ 'UIKit' ], [], noopBunyanLogger)
			.then(metabase => {
				// TODO Verify that we have a unified metabase that has all dependencies!
				metabase.should.be.ok;

				metabase.should.have.property('classes');
				metabase.classes.should.have.property('UILabel'); // from UIKit, which we explicitly stated as a used framework
				metabase.classes.should.have.property('NSObject'); // from Foundation

				done();
			})
			.catch(err => done(err));
	});
});

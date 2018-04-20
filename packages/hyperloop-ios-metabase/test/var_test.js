/* eslint-disable no-unused-expressions */
'use strict';

const path = require('path');

const should = require('should');

const helper = require('./helper');
const ThirdPartyFramework = require('../lib/third_party_frameworks').ThirdPartyFramework;
const SDKEnvironment = require('../lib/sdk').SDKEnvironment;

describe('var', function () {
	const tmpdir = path.join(__dirname, 'tmp'); // Re-use same cache dir for the suite
	let sdk;

	before(done => {
		SDKEnvironment.fromTypeAndMinimumVersion('iphonesimulator', '9.0').then(
			theSDK => {
				sdk = theSDK;
				done();
			},
			err => done(err)
		);
	});

	it('should generate var', done => {
		const frameworkName = 'Vars';
		const framework = new ThirdPartyFramework(frameworkName, [ helper.getFixture('vars.h') ], [], []);
		framework.cacheDir = tmpdir;
		framework.generateMetabase(sdk)
			.then(json => {
				should(json).be.an.object;
				should(sdk).be.an.object;
				should(json).have.property('metadata');
				should(json).not.have.property('classes');
				should(json).not.have.property('typedefs');
				should(json).not.have.property('protocols');
				should(json).not.have.property('enums');
				should(json).have.property('vars', {
					A: {
						framework: frameworkName,
						filename: helper.getFixture('vars.h'),
						introducedIn: '0.0.0',
						line: '1',
						name: 'A',
						type: 'int',
						value: '',
						encoding: 'i'
					},
					B: {
						framework: frameworkName,
						filename: helper.getFixture('vars.h'),
						introducedIn: '0.0.0',
						line: '2',
						name: 'B',
						type: 'int',
						value: '',
						encoding: 'i'
					}
				});
				should(json.metadata).have.property('api-version', '1');
				should(json.metadata).have.property('generated');
				should(json.metadata).have.property('min-version', sdk.minVersion);
				should(json.metadata).have.property('sdk-path', sdk.sdkPath);
				should(json.metadata).have.property('platform', 'ios');
				should(json.metadata.generated).match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2,}Z/);
				done();
			})
			.catch(err => done(err));
	});

});

/* eslint-disable no-unused-expressions */
'use strict';

const path = require('path');

const should = require('should');

const helper = require('./helper');
const ThirdPartyFramework = require('../lib/third_party_frameworks').ThirdPartyFramework;
const SDKEnvironment = require('../lib/sdk').SDKEnvironment;

describe('struct', () => {
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

	it('should generate structs', done => {
		const frameworkName = 'Structs';
		const filename = helper.getFixture('struct.h');
		const framework = new ThirdPartyFramework(frameworkName, [ filename ], [], []);
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
				should(json).not.have.property('vars');
				should(json).not.have.property('functions');
				should(json).have.property('structs', {
					A: {
						fields: [
							{
								encoding: 'f',
								name: 'a',
								type: 'float'
							}
						],
						framework: frameworkName,
						thirdparty: true,
						introducedIn: '0.0.0',
						filename: filename,
						line: '1',
						name: 'A'
					},
					B: {
						framework: frameworkName,
						thirdparty: true,
						introducedIn: '0.0.0',
						filename: filename,
						line: '2',
						name: 'B'
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

/* eslint-disable no-unused-expressions */
'use strict';

const path = require('path');

const should = require('should');

const helper = require('./helper');
const ThirdPartyFramework = require('../lib/third_party_frameworks').ThirdPartyFramework;
const SDKEnvironment = require('../lib/sdk').SDKEnvironment;

describe('enum', () => {
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

	it('should generate enums', done => {
		const frameworkName = 'Enums';
		const filename = helper.getFixture('enums.h');
		const framework = new ThirdPartyFramework(frameworkName, [ filename ], [], []);
		framework.cacheDir = tmpdir;
		framework.generateMetabase(sdk)
			.then(json => {
				should(json).be.an.object;
				should(sdk).be.an.object;
				should(json).have.property('metadata');
				should(json).not.have.property('classes');
				should(json).not.have.property('protocols');
				should(json).not.have.property('vars');
				should(json).have.property('enums');
				should(json.enums).have.property('Color');
				should(json.enums.Color).have.property('values', {
					RED: 0,
					GREEN: 1,
					BLUE: 2
				});
				should(json.enums).have.property('ABC');
				should(json.enums.ABC).have.property('values', {
					A: 0,
					B: 1,
					C: 10,
					D: 11,
					E: 1,
					F: 2,
					G: 12
				});
				should(json.enums._NSMatrixMode).have.property('values', {
					NSHighlightModeMatrix: 1,
					NSListModeMatrix: 2,
					NSRadioModeMatrix: 0,
					NSTrackModeMatrix: 3
				});
				should(json.typedefs).have.property('NSMatrixMode', {
					encoding: 'i',
					filename: filename,
					framework: frameworkName,
					thirdparty: true,
					introducedIn: '0.0.0',
					line: '8',
					type: 'enum',
					value: 'enum _NSMatrixMode'
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

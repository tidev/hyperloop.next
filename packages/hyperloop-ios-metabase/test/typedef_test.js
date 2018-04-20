/* eslint-disable no-unused-expressions */
'use strict';

const path = require('path');

const should = require('should');

const helper = require('./helper');
const ThirdPartyFramework = require('../lib/third_party_frameworks').ThirdPartyFramework;
const SDKEnvironment = require('../lib/sdk').SDKEnvironment;

describe('typedef', () => {
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

	it('should generate typedef', done => {
		const frameworkName = 'SimpleTypedef';
		const filename = helper.getFixture('simple_typedef.h');
		const framework = new ThirdPartyFramework(frameworkName, [ filename ], [], []);
		framework.cacheDir = tmpdir;
		framework.generateMetabase(sdk)
			.then(json => {
				should(json).be.an.object;
				should(sdk).be.an.object;
				should(json).have.property('metadata');
				should(json).have.property('typedefs', {
					i: {
						encoding: 'i',
						framework: frameworkName,
						filename: filename,
						introducedIn: '0.0.0',
						line: '2',
						type: 'int',
						value: 'int'
					},
					s: {
						encoding: 's',
						framework: frameworkName,
						filename: filename,
						introducedIn: '0.0.0',
						line: '3',
						type: 'short',
						value: 'short'
					},
					l: {
						encoding: 'l',
						framework: frameworkName,
						filename: filename,
						introducedIn: '0.0.0',
						line: '4',
						type: 'long',
						value: 'long'
					},
					d: {
						encoding: 'd',
						framework: frameworkName,
						filename: filename,
						introducedIn: '0.0.0',
						line: '5',
						type: 'double',
						value: 'double'
					},
					f: {
						encoding: 'f',
						framework: frameworkName,
						filename: filename,
						introducedIn: '0.0.0',
						line: '6',
						type: 'float',
						value: 'float'
					},
					c: {
						encoding: 'c',
						framework: frameworkName,
						filename: filename,
						introducedIn: '0.0.0',
						line: '7',
						type: 'char_s',
						value: 'char'
					},
					q: {
						encoding: 'q',
						framework: frameworkName,
						filename: filename,
						introducedIn: '0.0.0',
						line: '8',
						type: 'long_long',
						value: 'long long'
					},
					C: {
						encoding: 'C',
						framework: frameworkName,
						filename: filename,
						introducedIn: '0.0.0',
						line: '9',
						type: 'uchar',
						value: 'unsigned char'
					},
					I: {
						encoding: 'I',
						framework: frameworkName,
						filename: filename,
						introducedIn: '0.0.0',
						line: '10',
						type: 'uint',
						value: 'unsigned int'
					},
					S: {
						encoding: 'S',
						framework: frameworkName,
						filename: filename,
						introducedIn: '0.0.0',
						line: '11',
						type: 'ushort',
						value: 'unsigned short'
					},
					L: {
						encoding: 'L',
						framework: frameworkName,
						filename: filename,
						introducedIn: '0.0.0',
						line: '12',
						type: 'ulong',
						value: 'unsigned long'
					},
					Q: {
						encoding: 'Q',
						framework: frameworkName,
						filename: filename,
						introducedIn: '0.0.0',
						line: '13',
						type: 'ulonglong',
						value: 'unsigned long long'
					},
					B: {
						encoding: 'i',
						framework: frameworkName,
						filename: filename,
						introducedIn: '0.0.0',
						line: '14',
						type: 'int',
						value: 'int'
					},
					BB: {
						encoding: 'B',
						framework: frameworkName,
						filename: filename,
						introducedIn: '0.0.0',
						line: '15',
						type: 'bool',
						value: '_Bool'
					},
					v: {
						encoding: 'v',
						framework: frameworkName,
						filename: filename,
						introducedIn: '0.0.0',
						line: '16',
						type: 'void',
						value: 'void'
					},
					vv: {
						encoding: '^v',
						framework: frameworkName,
						filename: filename,
						introducedIn: '0.0.0',
						line: '17',
						type: 'pointer',
						value: 'void *'
					},
					vvv: {
						encoding: '^^v',
						framework: frameworkName,
						filename: filename,
						introducedIn: '0.0.0',
						line: '18',
						type: 'pointer',
						value: 'void **'
					},
					CS: {
						encoding: '*',
						framework: frameworkName,
						filename: filename,
						introducedIn: '0.0.0',
						line: '19',
						type: 'pointer',
						value: 'char *'
					},
					CSS: {
						encoding: '^*',
						framework: frameworkName,
						filename: filename,
						introducedIn: '0.0.0',
						line: '20',
						type: 'pointer',
						value: 'char **'
					},
					ID: {
						encoding: '@',
						framework: frameworkName,
						filename: filename,
						introducedIn: '0.0.0',
						line: '21',
						type: 'objc_pointer',
						value: 'id'
					},
					SE: {
						encoding: '^:',
						framework: frameworkName,
						filename: filename,
						introducedIn: '0.0.0',
						line: '22',
						type: 'pointer',
						value: 'SEL *'
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

	it('should generate nameless typedef', done => {
		const frameworkName = 'NamelessTypedef';
		const filename = helper.getFixture('nameless_typedef.h');
		const framework = new ThirdPartyFramework(frameworkName, [ filename ], [], []);
		framework.cacheDir = tmpdir;
		framework.generateMetabase(sdk)
			.then(json => {
				should(json).be.an.object;
				should(sdk).be.an.object;
				should(json).have.property('metadata');
				should(json).have.property('typedefs', {
					UIFloatRange: {
						encoding: '{UIFloatRange=ff}',
						framework: frameworkName,
						filename: filename,
						introducedIn: '0.0.0',
						line: '4',
						type: 'struct',
						value: 'UIFloatRange'
					},
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

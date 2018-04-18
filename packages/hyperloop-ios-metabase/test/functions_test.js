/* eslint-disable no-unused-expressions */
'use strict';

const path = require('path');

const should = require('should');

const helper = require('./helper');
const ThirdPartyFramework = require('../lib/third_party_frameworks').ThirdPartyFramework;
const SDKEnvironment = require('../lib/sdk').SDKEnvironment;

describe('function', () => {
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

	it('should generate functions', done => {
		const frameworkName = 'Functions';
		const filename = helper.getFixture('functions.h');
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
				should(json).have.property('functions', {
					Foo: {
						arguments: [],
						name: 'Foo',
						filename: filename,
						framework: frameworkName,
						thirdparty: true,
						introducedIn: '0.0.0',
						line: '1',
						returns: {
							type: 'void',
							value: 'void',
							encoding: 'v'
						}
					},
					Bar: {
						arguments: [
							{
								encoding: 'f',
								type: 'float',
								value: 'float'
							}
						],
						filename: filename,
						framework: frameworkName,
						thirdparty: true,
						introducedIn: '0.0.0',
						line: '2',
						name: 'Bar',
						returns: {
							type: 'int',
							value: 'int',
							encoding: 'i'
						}
					},
					A: {
						arguments: [
							{
								encoding: '*',
								name: 'name',
								type: 'pointer',
								value: 'char *'
							},
							{
								encoding: 'i',
								name: 'size',
								type: 'int',
								value: 'int'
							}
						],
						filename: filename,
						framework: frameworkName,
						thirdparty: true,
						introducedIn: '0.0.0',
						line: '3',
						name: 'A',
						returns: {
							type: 'pointer',
							value: 'char *',
							encoding: '^c'
						}
					},
					Block: {
						arguments: [
							{
								encoding: '@?',
								type: 'block',
								value: 'void (^)(int)'
							}
						],
						filename: filename,
						framework: frameworkName,
						thirdparty: true,
						introducedIn: '0.0.0',
						line: '4',
						name: 'Block',
						returns: {
							type: 'void',
							value: 'void',
							encoding: 'v'
						}
					},
					NamedBlock: {
						arguments: [
							{
								encoding: '@?',
								name: 'Name',
								type: 'block',
								value: 'void (^)(int)'
							}
						],
						filename: filename,
						framework: frameworkName,
						thirdparty: true,
						introducedIn: '0.0.0',
						line: '5',
						name: 'NamedBlock',
						returns: {
							type: 'void',
							value: 'void',
							encoding: 'v'
						}
					},
					Function: {
						arguments: [
							{
								encoding: '^?',
								name: 'foo',
								type: 'pointer',
								value: 'void (*)(int)'
							}
						],
						filename: filename,
						framework: frameworkName,
						thirdparty: true,
						introducedIn: '0.0.0',
						line: '6',
						name: 'Function',
						returns: {
							type: 'void',
							value: 'void',
							encoding: 'v'
						}
					},
					Variadic: {
						arguments: [ {
							encoding: '*',
							type: 'pointer',
							value: 'char *'
						} ],
						filename: filename,
						framework: frameworkName,
						thirdparty: true,
						introducedIn: '0.0.0',
						line: '7',
						name: 'Variadic',
						returns: {
							type: 'void',
							value: 'void',
							encoding: 'v'
						},
						variadic: true
					}
				});
				should(json).have.property('blocks');
				should(json.blocks).have.property(frameworkName, [
					{
						arguments: [
							{
								encoding: 'i',
								type: 'int',
								value: 'int'
							}
						],
						encoding: '@?',
						returns: {
							encoding: 'v',
							type: 'void',
							value: 'void'
						},
						signature: 'void (^)(int)',
						type: 'block'
					}
				]);
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

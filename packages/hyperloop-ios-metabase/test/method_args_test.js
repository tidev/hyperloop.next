/* eslint-disable no-unused-expressions */
'use strict';

const path = require('path');

const should = require('should');

const helper = require('./helper');
const ThirdPartyFramework = require('../lib/third_party_frameworks').ThirdPartyFramework;
const SDKEnvironment = require('../lib/sdk').SDKEnvironment;

describe('method args', () => {
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

	it('should generate constructor', done => {
		const frameworkName = 'MethodArgConstructor';
		const filename = helper.getFixture('method_arg_constructor.h');
		const framework = new ThirdPartyFramework(frameworkName, [ filename ], [], []);
		framework.cacheDir = tmpdir;
		framework.generateMetabase(sdk)
			.then(json => {
				should(json).be.an.object;
				should(sdk).be.an.object;
				should(json).have.property('metadata');
				should(json).have.property('classes', {
					A: {
						name: 'A',
						filename: filename,
						framework: frameworkName,
						thirdparty: true,
						introducedIn: '0.0.0',
						line: '1',
						methods: {
							init: {
								arguments: [],
								constructor: true,
								encoding: '@16@0:8',
								name: 'init',
								selector: 'init',
								instance: true,
								returns: {
									encoding: '@',
									type: 'obj_interface',
									value: 'instancetype'
								}
							}
						}
					}
				});
				should(json).not.have.property('typedefs');
				should(json).not.have.property('protocols');
				should(json).not.have.property('enums');
				should(json).not.have.property('vars');
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

	it('should generate method with SEL arg', done => {
		const frameworkName = 'MethodArgSelector';
		const filename = helper.getFixture('method_arg_selector.h');
		const framework = new ThirdPartyFramework(frameworkName, [ filename ], [], []);
		framework.cacheDir = tmpdir;
		framework.generateMetabase(sdk)
			.then(json => {
				should(json).be.an.object;
				should(sdk).be.an.object;
				should(json).have.property('metadata');
				should(json).have.property('classes', {
					A: {
						name: 'A',
						framework: frameworkName,
						thirdparty: true,
						introducedIn: '0.0.0',
						filename: filename,
						line: '1',
						methods: {
							'initWithFoo:': {
								arguments: [
									{
										encoding: ':',
										name: 'sel',
										type: 'SEL',
										value: 'SEL'
									}
								],
								encoding: 'v24@0:8:16',
								instance: true,
								name: 'initWithFoo',
								selector: 'initWithFoo:',
								returns: {
									type: 'void',
									value: 'void',
									encoding: 'v'
								}
							}
						}
					},
					B: {
						framework: frameworkName,
						thirdparty: true,
						introducedIn: '0.0.0',
						filename: filename,
						line: '5',
						methods: {
							'foo:bar:c:': {
								arguments: [
									{
										encoding: '@',
										name: 'foo',
										type: 'objc_pointer',
										value: 'A *'
									},
									{
										encoding: ':',
										name: 'sel',
										type: 'SEL',
										value: 'SEL'
									},
									{
										encoding: 'i',
										name: 'd',
										type: 'int',
										value: 'int'
									}
								],
								encoding: '@36@0:8@16:24i32',
								instance: true,
								name: 'fooBarC',
								returns: {
									type: 'obj_interface',
									value: 'A *',
									encoding: '@'
								},
								selector: 'foo:bar:c:'
							}
						},
						name: 'B'
					}
				});
				should(json).not.have.property('typedefs');
				should(json).not.have.property('protocols');
				should(json).not.have.property('enums');
				should(json).not.have.property('vars');
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

	it('should generate method with multiple arg', done => {
		const frameworkName = 'MethodArgMulti';
		const filename = helper.getFixture('method_arg_multi.h');
		const framework = new ThirdPartyFramework(frameworkName, [ filename ], [], []);
		framework.cacheDir = tmpdir;
		framework.generateMetabase(sdk)
			.then(json => {
				should(json).be.an.object;
				should(sdk).be.an.object;
				should(json).have.property('metadata');
				should(json).have.property('classes', {
					A: {
						name: 'A',
						framework: frameworkName,
						thirdparty: true,
						introducedIn: '0.0.0',
						filename: filename,
						line: '1',
						methods: {
							'initWithFoo:foo:': {
								arguments: [
									{
										encoding: ':',
										name: 'sel',
										type: 'SEL',
										value: 'SEL'
									},
									{
										encoding: 'i',
										name: 'bar',
										type: 'int',
										value: 'int'
									}
								],
								encoding: 'v28@0:8:16i24',
								instance: true,
								name: 'initWithFooFoo',
								selector: 'initWithFoo:foo:',
								returns: {
									type: 'void',
									value: 'void',
									encoding: 'v'
								}
							}
						}
					}
				});
				should(json).not.have.property('typedefs');
				should(json).not.have.property('protocols');
				should(json).not.have.property('enums');
				should(json).not.have.property('vars');
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

/* eslint-disable no-unused-expressions */
'use strict';

const path = require('path');

const should = require('should');

const helper = require('./helper');
const ThirdPartyFramework = require('../lib/third_party_frameworks').ThirdPartyFramework;
const SDKEnvironment = require('../lib/sdk').SDKEnvironment;

describe('block', function () {
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

	// TODO Add test for blocks in UIKit - that they grab correct typedefs/etc
	it('should generate blocks', done => {
		const frameworkName = 'BlockFramework';
		const framework = new ThirdPartyFramework(frameworkName, [ helper.getFixture('blocks.h') ], [], []);
		framework.cacheDir = tmpdir;
		framework.generateMetabase(sdk)
			.then(json => {
				should(json).be.an.object;
				should(sdk).be.an.object;
				should(json).have.property('metadata');
				should(json).not.have.property('protocols');
				should(json).not.have.property('enums');
				should(json).not.have.property('vars');
				should(json).have.property('classes', {
					A: {
						filename: helper.getFixture('blocks.h'),
						framework: frameworkName,
						introducedIn: '0.0.0',
						line: '2',
						methods: {
							'do:': {
								arguments: [
									{
										encoding: '@?',
										name: 'it',
										type: 'block',
										value: 'void (^)(int)'
									}
								],
								encoding: 'v24@0:8@?16',
								instance: true,
								name: 'do',
								returns: {
									encoding: 'v',
									type: 'void',
									value: 'void'
								},
								selector: 'do:'
							}
						},
						name: 'A',
						thirdparty: true
					},
					Blockception: {
						filename: helper.getFixture('blocks.h'),
						framework: frameworkName,
						introducedIn: '0.0.0',
						line: '10',
						methods: {
							'blockWithin:': {
								arguments: [
									{
										encoding: '@?',
										name: 'block',
										type: 'block',
										value: 'void (^)(int, void (^)(float))'
									}
								],
								encoding: 'v24@0:8@?16',
								instance: true,
								name: 'blockWithin',
								returns: {
									encoding: 'v',
									type: 'void',
									value: 'void'
								},
								selector: 'blockWithin:'
							}
						},
						name: 'Blockception',
						thirdparty: true
					},
					C: {
						filename: helper.getFixture('blocks.h'),
						framework: frameworkName,
						introducedIn: '0.0.0',
						line: '6',
						methods: {
							foo: {
								arguments: [],
								encoding: '@?16@0:8',
								instance: true,
								name: 'foo',
								returns: {
									encoding: '@?',
									type: 'block',
									value: 'MyBlock'
								},
								selector: 'foo'
							}
						},
						name: 'C',
						thirdparty: true
					}
				});
				should(json).have.property('functions', {
					B: {
						arguments: [
							{
								encoding: '@?',
								name: 'Block',
								type: 'block',
								value: 'void (^)(int)'
							}
						],
						filename: helper.getFixture('blocks.h'),
						framework: frameworkName,
						thirdparty: true,
						introducedIn: '0.0.0',
						line: '1',
						name: 'B',
						returns: {
							encoding: 'v',
							type: 'void',
							value: 'void'
						}
					}
				});
				should(json).have.property('typedefs', {
					MyBlock: {
						encoding: '@?',
						filename: helper.getFixture('blocks.h'),
						framework: frameworkName,
						thirdparty: true,
						introducedIn: '0.0.0',
						line: '5',
						type: 'block',
						value: 'void (^)(void)'
					}
				});
				should(json).have.property('blocks');
				should(json.blocks).have.property(frameworkName, [
					{
						arguments: [
							{
								encoding: 'f',
								type: 'float',
								value: 'float'
							}
						],
						encoding: '@?',
						returns: {
							encoding: 'v',
							type: 'void',
							value: 'void'
						},
						signature: 'void (^)(float)',
						type: 'block'
					},
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
					},
					{
						arguments: [
							{
								encoding: 'i',
								type: 'int',
								value: 'int'
							},
							{
								encoding: '@?',
								name: 'levelTwoBlockHandler',
								type: 'block',
								value: 'void (^)(float)'
							}
						],
						encoding: '@?',
						returns: {
							encoding: 'v',
							type: 'void',
							value: 'void'
						},
						signature: 'void (^)(int, void (^)(float))',
						type: 'block'
					},
					{
						arguments: [],
						encoding: '@?',
						returns: {
							encoding: 'v',
							type: 'void',
							value: 'void'
						},
						signature: 'void (^)(void)',
						type: 'block'
					},
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

/* eslint-disable no-unused-expressions */
'use strict';

const path = require('path');

const should = require('should');

const helper = require('./helper');
const ThirdPartyFramework = require('../lib/third_party_frameworks').ThirdPartyFramework;
const SDKEnvironment = require('../lib/sdk').SDKEnvironment;

describe('protocol', () => {
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

	it('should generate empty protocol', done => {
		const frameworkName = 'EmptyProtocol';
		const filename = helper.getFixture('empty_protocol.h');
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

	it('should generate simple protocol', done => {
		const frameworkName = 'SimpleProtocol';
		const filename = helper.getFixture('simple_protocol.h');
		const framework = new ThirdPartyFramework(frameworkName, [ filename ], [], []);
		framework.cacheDir = tmpdir;
		framework.generateMetabase(sdk)
			.then(json => {
				should(json).be.an.object;
				should(sdk).be.an.object;
				should(json).have.property('metadata');
				should(json).have.property('protocols', {
					A: {
						framework: frameworkName,
						thirdparty: true,
						filename: filename,
						introducedIn: '0.0.0',
						line: '2',
						methods: {
							a: {
								arguments: [],
								encoding: 'v16@0:8',
								instance: true,
								returns: {
									type: 'void',
									value: 'void',
									encoding: 'v'
								},
								selector: 'a',
								name: 'a'
							}
						},
						name: 'A'
					}
				});
				should(json).not.have.property('typedefs');
				should(json).not.have.property('classes');
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

	it('should generate simple protocol with optional property', done => {
		const frameworkName = 'SimpleProtocolWithOptionalProperty';
		const filename = helper.getFixture('simple_protocol_with_optional_property.h');
		const framework = new ThirdPartyFramework(frameworkName, [ filename ], [], []);
		framework.cacheDir = tmpdir;
		framework.generateMetabase(sdk)
			.then(json => {
				should(json).be.an.object;
				should(sdk).be.an.object;
				should(json).have.property('metadata');
				should(json).have.property('protocols', {
					A: {
						framework: frameworkName,
						thirdparty: true,
						filename: filename,
						introducedIn: '0.0.0',
						line: '2',
						methods: {
							a: {
								arguments: [],
								encoding: 'v16@0:8',
								instance: true,
								optional: true,
								returns: {
									type: 'void',
									value: 'void',
									encoding: 'v'
								},
								selector: 'a',
								name: 'a'
							}
						},
						name: 'A'
					}
				});
				should(json).not.have.property('typedefs');
				should(json).not.have.property('classes');
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

	it('should generate simple protocol with required property', done => {
		const frameworkName = 'SimpleProtocolWithRequiredProperty';
		const filename = helper.getFixture('simple_protocol_with_required_property.h');
		const framework = new ThirdPartyFramework(frameworkName, [ filename ], [], []);
		framework.cacheDir = tmpdir;
		framework.generateMetabase(sdk)
			.then(json => {
				should(json).be.an.object;
				should(sdk).be.an.object;
				should(json).have.property('metadata');
				should(json).have.property('protocols', {
					A: {
						framework: frameworkName,
						thirdparty: true,
						filename: filename,
						introducedIn: '0.0.0',
						line: '2',
						methods: {
							a: {
								arguments: [],
								encoding: 'v16@0:8',
								instance: true,
								returns: {
									type: 'void',
									value: 'void',
									encoding: 'v'
								},
								selector: 'a',
								name: 'a'
							}
						},
						name: 'A'
					}
				});
				should(json).not.have.property('typedefs');
				should(json).not.have.property('classes');
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

	it('should generate simple protocol with required property and class method', done => {
		const frameworkName = 'SimpleProtocolWithRequiredMethod';
		const filename = helper.getFixture('simple_protocol_with_required_method.h');
		const framework = new ThirdPartyFramework(frameworkName, [ filename ], [], []);
		framework.cacheDir = tmpdir;
		framework.generateMetabase(sdk)
			.then(json => {
				should(json).be.an.object;
				should(sdk).be.an.object;
				should(json).have.property('metadata');
				should(json).have.property('protocols', {
					A: {
						framework: frameworkName,
						thirdparty: true,
						filename: filename,
						introducedIn: '0.0.0',
						line: '2',
						methods: {
							a: {
								arguments: [],
								encoding: 'v16@0:8',
								instance: false,
								returns: {
									type: 'void',
									value: 'void',
									encoding: 'v'
								},
								selector: 'a',
								name: 'a'
							}
						},
						name: 'A'
					}
				});
				should(json).not.have.property('typedefs');
				should(json).not.have.property('classes');
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

	// it('should merge incorporated protocol methods and properties', function (done) {
	// 	helper.generate(helper.getFixture('protocol_inheritance.h'), helper.getTempFile('protocol.json'), function (err, json, sdk) {
	// 		assert.ifError(err);
	//
	// 		var baseProtocol = {
	// 			filename: helper.getFixture('protocol_inheritance.h'),
	// 			framework: helper.getFixture('protocol_inheritance.h'),
	// 			introducedIn: '0.0.0',
	// 			line: '1',
	// 			methods: {
	// 				a: {
	// 					arguments: [],
	// 					encoding: 'f16@0:8',
	// 					instance: true,
	// 					name: 'a',
	// 					returns: { encoding: 'f', type: 'float', value: 'float' },
	// 					selector: 'a'
	// 				},
	// 				b: {
	// 					arguments: [],
	// 					encoding: 'v16@0:8',
	// 					instance: true,
	// 					name: 'b',
	// 					returns: { encoding: 'v', type: 'void', value: 'void' },
	// 					selector: 'b'
	// 				},
	// 				'setA:': {
	// 					arguments: [
	// 						{ encoding: 'f', name: 'a', type: 'float', value: 'float' }
	// 					],
	// 					encoding: 'v20@0:8f16',
	// 					instance: true,
	// 					name: 'setA',
	// 					returns: { encoding: 'v', type: 'void', value: 'void' },
	// 					selector: 'setA:'
	// 				}
	// 			},
	// 			name: 'BaseProtocol',
	// 			properties: {
	// 				a: {
	// 					name: 'a',
	// 					optional: false,
	// 					type: { type: 'float', value: 'float' }
	// 				}
	// 			},
	// 			thirdparty: true
	// 		};
	// 		should(json).have.property('protocols', {
	// 			BaseProtocol: baseProtocol,
	// 			MyProtocol: {
	// 				filename: helper.getFixture('protocol_inheritance.h'),
	// 				framework: helper.getFixture('protocol_inheritance.h'),
	// 				introducedIn: '0.0.0',
	// 				line: '8',
	// 				methods: {
	// 					c: {
	// 						arguments: [],
	// 						encoding: 'v16@0:8',
	// 						instance: true,
	// 						name: 'c',
	// 						returns: { encoding: 'v', type: 'void', value: 'void' },
	// 						selector: 'c'
	// 					}
	// 				},
	// 				name: 'MyProtocol',
	// 				protocols: [ 'BaseProtocol' ],
	// 				thirdparty: true
	// 			}
	// 		});
	//
	// 		// var generate = rewire('../lib/generate/index');
	// 		// var processIncorporatedProtocols = generate.__get__('processIncorporatedProtocols');
	// 		// processIncorporatedProtocols(json.protocols);
	// 		should(json).have.property('protocols', {
	// 			BaseProtocol: baseProtocol,
	// 			MyProtocol: {
	// 				filename: helper.getFixture('protocol_inheritance.h'),
	// 				framework: helper.getFixture('protocol_inheritance.h'),
	// 				introducedIn: '0.0.0',
	// 				line: '8',
	// 				methods: {
	// 					a: {
	// 						arguments: [],
	// 						encoding: 'f16@0:8',
	// 						instance: true,
	// 						name: 'a',
	// 						returns: { encoding: 'f', type: 'float', value: 'float' },
	// 						selector: 'a'
	// 					},
	// 					b: {
	// 						arguments: [],
	// 						encoding: 'v16@0:8',
	// 						instance: true,
	// 						name: 'b',
	// 						returns: { encoding: 'v', type: 'void', value: 'void' },
	// 						selector: 'b'
	// 					},
	// 					c: {
	// 						arguments: [],
	// 						encoding: 'v16@0:8',
	// 						instance: true,
	// 						name: 'c',
	// 						returns: { encoding: 'v', type: 'void', value: 'void' },
	// 						selector: 'c'
	// 					},
	// 					'setA:': {
	// 						arguments: [
	// 							{ encoding: 'f', name: 'a', type: 'float', value: 'float' }
	// 						],
	// 						encoding: 'v20@0:8f16',
	// 						instance: true,
	// 						name: 'setA',
	// 						returns: { encoding: 'v', type: 'void', value: 'void' },
	// 						selector: 'setA:'
	// 					}
	// 				},
	// 				name: 'MyProtocol',
	// 				properties: {
	// 					a: {
	// 						name: 'a',
	// 						optional: false,
	// 						type: { type: 'float', value: 'float' }
	// 					}
	// 				},
	// 				protocols: [ 'BaseProtocol' ],
	// 				thirdparty: true
	// 			}
	// 		});
	//
	// 		done();
	// 	});
	// });
});

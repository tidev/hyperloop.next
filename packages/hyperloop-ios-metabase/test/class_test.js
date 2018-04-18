/* eslint-disable no-unused-expressions */
'use strict';

const path = require('path');

const should = require('should');

const helper = require('./helper');
const ThirdPartyFramework = require('../lib/third_party_frameworks').ThirdPartyFramework;
const SDKEnvironment = require('../lib/sdk').SDKEnvironment;

describe('class', function () {
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

	it('should generate empty class', done => {
		const framework = new ThirdPartyFramework('EmptyClass', [ helper.getFixture('empty_class.h') ], [], []);
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

	it('should generate empty class with system headers', done => {
		const framework = new ThirdPartyFramework('EmptyClassWithSystemHeaders', [ helper.getFixture('empty_class_with_systemheaders.h') ], [], []);
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

	it('should generate simple class', done => {
		const frameworkName = 'SimpleClass';
		const framework = new ThirdPartyFramework(frameworkName, [ helper.getFixture('simple_class.h') ], [], []);
		framework.cacheDir = tmpdir;
		framework.generateMetabase(sdk)
			.then(json => {
				should(json).be.an.object;
				should(sdk).be.an.object;
				should(json).have.property('metadata');
				should(json).have.property('classes', {
					A: {
						filename: helper.getFixture('simple_class.h'),
						framework: frameworkName,
						thirdparty: true,
						introducedIn: '0.0.0',
						line: '1',
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

	it('should generate simple class with protocol', done => {
		const frameworkName = 'SimpleClassWithProtocol';
		const framework = new ThirdPartyFramework(frameworkName, [ helper.getFixture('simple_class_with_protocol.h') ], [], []);
		framework.cacheDir = tmpdir;
		framework.generateMetabase(sdk)
			.then(json => {
				should(json).be.an.object;
				should(sdk).be.an.object;
				should(json).have.property('metadata');
				should(json).have.property('classes', {
					A: {
						framework: frameworkName,
						thirdparty: true,
						filename: helper.getFixture('simple_class_with_protocol.h'),
						introducedIn: '0.0.0',
						line: '6',
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
						name: 'A',
						protocols: [ 'B' ]
					}
				});
				should(json).have.property('protocols', {
					B: {
						framework: frameworkName,
						thirdparty: true,
						filename: helper.getFixture('simple_class_with_protocol.h'),
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

	it('should generate simple class with superclass', done => {
		const frameworkName = 'SimpleClassWithSuperClass';
		const framework = new ThirdPartyFramework(frameworkName, [ helper.getFixture('simple_class_with_superclass.h') ], [], []);
		framework.cacheDir = tmpdir;
		framework.generateMetabase(sdk)
			.then(json => {
				should(json).be.an.object;
				should(sdk).be.an.object;
				should(json).have.property('metadata');
				should(json).have.property('classes', {
					A: {
						framework: frameworkName,
						thirdparty: true,
						filename: helper.getFixture('simple_class_with_superclass.h'),
						introducedIn: '0.0.0',
						line: '6',
						name: 'A',
						superclass: 'B'
					},
					B: {
						framework: frameworkName,
						thirdparty: true,
						filename: helper.getFixture('simple_class_with_superclass.h'),
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

	it('should generate simple class with superclass and protocol', done => {
		const frameworkName = 'SimpleClassWithSuperClassAndProtocol';
		const framework = new ThirdPartyFramework(frameworkName, [ helper.getFixture('simple_class_with_superclass_and_protocol.h') ], [], []);
		framework.cacheDir = tmpdir;
		framework.generateMetabase(sdk)
			.then(json => {
				should(json).be.an.object;
				should(sdk).be.an.object;
				should(json).have.property('metadata');
				should(json).have.property('classes', {
					A: {
						framework: frameworkName,
						thirdparty: true,
						filename: helper.getFixture('simple_class_with_superclass_and_protocol.h'),
						introducedIn: '0.0.0',
						line: '10',
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
							},
							b: {
								arguments: [],
								encoding: 'v16@0:8',
								instance: true,
								returns: {
									type: 'void',
									value: 'void',
									encoding: 'v'
								},
								selector: 'b',
								name: 'b'
							}
						},
						name: 'A',
						protocols: [ 'B' ],
						superclass: 'C'
					},
					C: {
						framework: frameworkName,
						thirdparty: true,
						filename: helper.getFixture('simple_class_with_superclass_and_protocol.h'),
						introducedIn: '0.0.0',
						line: '6',
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
						name: 'C'
					}
				});
				should(json).have.property('protocols', {
					B: {
						framework: frameworkName,
						thirdparty: true,
						filename: helper.getFixture('simple_class_with_superclass_and_protocol.h'),
						introducedIn: '0.0.0',
						line: '2',
						methods: {
							b: {
								arguments: [],
								encoding: 'v16@0:8',
								instance: true,
								returns: {
									type: 'void',
									value: 'void',
									encoding: 'v'
								},
								selector: 'b',
								name: 'b'
							}
						},
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

	it('should generate class with properties', done => {
		const frameworkName = 'ClassWithProperties';
		const framework = new ThirdPartyFramework(frameworkName, [ helper.getFixture('class_with_properties.h') ], [], []);
		framework.cacheDir = tmpdir;
		framework.generateMetabase(sdk)
			.then(json => {
				should(json).be.an.object;
				should(sdk).be.an.object;
				should(json).have.property('metadata');
				should(json).not.have.property('typedefs');
				should(json).not.have.property('protocols');
				should(json).not.have.property('enums');
				should(json).not.have.property('vars');
				should(json).not.have.property('functions');
				should(json.metadata).have.property('api-version', '1');
				should(json.metadata).have.property('generated');
				should(json.metadata).have.property('min-version', sdk.minVersion);
				should(json.metadata).have.property('sdk-path', sdk.sdkPath);
				should(json.metadata).have.property('platform', 'ios');
				should(json).have.property('classes', {
					A: {
						framework: frameworkName,
						thirdparty: true,
						filename: helper.getFixture('class_with_properties.h'),
						introducedIn: '0.0.0',
						line: '1',
						methods: {
							a: {
								arguments: [],
								encoding: 'f16@0:8',
								instance: true,
								returns: {
									type: 'float',
									value: 'float',
									encoding: 'f'
								},
								selector: 'a',
								name: 'a'
							},
							b: {
								arguments: [],
								encoding: 'f16@0:8',
								instance: false,
								name: 'b',
								returns:
								{
									encoding: 'f',
									type: 'float',
									value: 'float'
								},
								selector: 'b'
							},
							'setA:': {
								arguments: [
									{ encoding: 'f', name: 'a', type: 'float', value: 'float' }
								],
								instance: true,
								encoding: 'v20@0:8f16',
								name: 'setA',
								returns: {
									encoding: 'v',
									type: 'void',
									value: 'void'
								},
								selector: 'setA:'
							}
						},
						name: 'A',
						properties: {
							a: {
								name: 'a',
								optional: false,
								type: {
									type: 'float',
									value: 'float'
								}
							},
							b: {
								attributes: [ 'readonly', 'class' ],
								name: 'b',
								optional: false,
								type: {
									type: 'float',
									value: 'float'
								}
							}
						}
					}
				});
				done();
			})
			.catch(err => done(err));
	});

	it('should generate class with categories', done => {
		const frameworkName = 'ClassWithProperties';
		const filename = helper.getFixture('class_with_category.h');
		const framework = new ThirdPartyFramework(frameworkName, [ filename ], [], []);
		framework.cacheDir = tmpdir;
		framework.generateMetabase(sdk)
			.then(json => {
				should(json).be.an.object;
				should(sdk).be.an.object;
				should(json).have.property('metadata');
				should(json).not.have.property('typedefs');
				should(json).not.have.property('protocols');
				should(json).not.have.property('enums');
				should(json).not.have.property('vars');
				should(json).not.have.property('functions');
				should(json.metadata).have.property('api-version', '1');
				should(json.metadata).have.property('generated');
				should(json.metadata).have.property('min-version', sdk.minVersion);
				should(json.metadata).have.property('sdk-path', sdk.sdkPath);
				should(json.metadata).have.property('platform', 'ios');
				should(json.metadata.generated).match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2,}Z/);
				should(json).have.property('classes', {
					A: {
						categories: [ '', 'Name' ],
						name: 'A',
						filename: filename,
						framework: frameworkName,
						thirdparty: true,
						introducedIn: '0.0.0',
						line: '1',
						methods: {
							a: {
								arguments: [],
								encoding: 'f16@0:8',
								instance: true,
								name: 'a',
								returns: {
									encoding: 'f',
									type: 'float',
									value: 'float'
								},
								selector: 'a'
							},
							b: {
								arguments: [],
								encoding: 'f16@0:8',
								instance: true,
								name: 'b',
								returns: { encoding: 'f', type: 'float', value: 'float' },
								selector: 'b'
							},
							c: {
								arguments: [],
								encoding: 'f16@0:8',
								instance: true,
								name: 'c',
								returns: {
									encoding: 'f',
									type: 'float',
									value: 'float'
								},
								selector: 'c'
							},
							'setA:': {
								arguments: [
									{
										encoding: 'f',
										name: 'a',
										type: 'float',
										value: 'float'
									}
								],
								encoding: 'v20@0:8f16',
								instance: true,
								name: 'setA',
								returns: {
									encoding: 'v',
									type: 'void',
									value: 'void'
								},
								selector: 'setA:'
							},
							'setB:': {
								arguments: [
									{ encoding: 'f', name: 'b', type: 'float', value: 'float' }
								],
								encoding: 'v20@0:8f16',
								instance: true,
								name: 'setB',
								returns: { encoding: 'v', type: 'void', value: 'void' },
								selector: 'setB:'
							},
							'setC:': {
								arguments: [
									{
										encoding: 'f',
										name: 'c',
										type: 'float',
										value: 'float'
									}
								],
								encoding: 'v20@0:8f16',
								instance: true,
								name: 'setC',
								returns: {
									encoding: 'v',
									type: 'void',
									value: 'void'
								},
								selector: 'setC:'
							},
						},
						properties: {
							a: {
								name: 'a',
								optional: false,
								type: {
									value: 'float',
									type: 'float'
								}
							},
							b: {
								name: 'b',
								optional: false,
								type: {
									value: 'float',
									type: 'float'
								}
							},
							c: {
								name: 'c',
								optional: false,
								type: {
									value: 'float',
									type: 'float'
								}
							}
						}
					}
				});
				done();
			})
			.catch(err => done(err));
	});
});

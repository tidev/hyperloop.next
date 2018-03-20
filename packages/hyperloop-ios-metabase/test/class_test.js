/* eslint-disable no-unused-expressions */
'use strict';

const should = require('should'),
	helper = require('./helper'),
	path = require('path'),
	SDKEnvironment = require('../lib/sdk').SDKEnvironment;

describe('class', function () {
	let sdkDir;
	before(function (done) {
		SDKEnvironment.fromTypeAndMinimumVersion('iphonesimulator', '9.0').then(
			sdk => {
				sdkDir = sdk.sdkPath;
				done();
			},
			err => done(err)
		);
	});

	function foundationFile(filename) {
		return path.join(sdkDir, 'System/Library/Frameworks/Foundation.framework/Headers', filename);
	}

	it('should generate empty class', function (done) {
		helper.generate(helper.getFixture('empty_class.h'), helper.getTempFile('class.json'), function (err, json, sdk) {
			if (err) {
				return done(err);
			}
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
		});
	});

	it('should generate empty class with system headers', function (done) {
		helper.generate(helper.getFixture('empty_class_with_systemheaders.h'), helper.getTempFile('class.json'), function (err, json, sdk) {
			if (err) {
				return done(err);
			}
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
		}, true);
	});

	it('should generate class with system headers', function (done) {
		helper.generate(helper.getFixture('empty_class_with_systemheaders.h'), helper.getTempFile('class.json'), function (err, json, sdk) {
			if (err) {
				return done(err);
			}
			should(json).be.an.object;
			should(sdk).be.an.object;
			should(json).have.property('metadata');
			should(json).have.property('classes');
			should(json).have.property('typedefs');
			should(json).have.property('protocols');
			should(json).have.property('enums');
			should(json).have.property('vars');
			should(json.metadata).not.be.empty;
			should(json.classes).not.be.empty;
			should(json.typedefs).not.be.empty;
			should(json.protocols).not.be.empty;
			should(json.enums).not.be.empty;
			should(json.vars).not.be.empty;
			should(json.metadata).have.property('api-version', '1');
			should(json.metadata).have.property('generated');
			should(json.metadata).have.property('min-version', sdk.minVersion);
			should(json.metadata).have.property('sdk-path', sdk.sdkPath);
			should(json.metadata).have.property('platform', 'ios');
			should(json.metadata.generated).match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2,}Z/);
			should(json.classes).have.property('NSString');
			should(json.classes.NSString).have.property('filename', foundationFile('NSString.h'));
			should(json.classes.NSString).have.property('framework', 'Foundation');
			should(json.classes.NSString).have.property('line', '99');
			should(json.classes.NSString).have.property('name', 'NSString');
			should(json.classes.NSString).have.property('methods');
			should(json.classes.NSString).have.property('properties');
			should(json.classes.NSString).have.property('superclass', 'NSObject');
			should(json.classes.NSString).have.property('protocols', [ 'NSCopying', 'NSMutableCopying', 'NSSecureCoding', 'NSItemProviderReading', 'NSItemProviderWriting' ]);
			should(json.classes.NSString).have.property('categories', [ 'NSStringExtensionMethods', 'NSStringEncodingDetection', 'NSItemProvider', 'NSExtendedStringPropertyListParsing', 'NSStringDeprecated', 'NSBundleExtensionMethods', 'NSStringPathExtensions', 'NSURLUtilities', 'NSLinguisticAnalysis' ]);
			should(json.classes.NSString.properties).have.property('uppercaseString');
			should(json.classes.NSString.properties).have.property('stringByExpandingTildeInPath');
			should(json.classes.NSString.methods).have.property('writeToURL:atomically:encoding:error:');
			should(json.classes.NSString.methods).have.property('stringWithFormat:');
			done();
		});
	});

	it('should generate simple class', function (done) {
		helper.generate(helper.getFixture('simple_class.h'), helper.getTempFile('class.json'), function (err, json, sdk) {
			if (err) {
				return done(err);
			}
			should(json).be.an.object;
			should(sdk).be.an.object;
			should(json).have.property('metadata');
			should(json).have.property('classes', {
				A: {
					filename: helper.getFixture('simple_class.h'),
					framework: helper.getFixture('simple_class.h'),
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
		});
	});

	it('should generate simple class with protocol', function (done) {
		helper.generate(helper.getFixture('simple_class_with_protocol.h'), helper.getTempFile('class.json'), function (err, json, sdk) {
			if (err) {
				return done(err);
			}
			should(json).be.an.object;
			should(sdk).be.an.object;
			should(json).have.property('metadata');
			should(json).have.property('classes', {
				A: {
					framework: helper.getFixture('simple_class_with_protocol.h'),
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
					framework: helper.getFixture('simple_class_with_protocol.h'),
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
		});
	});

	it('should generate simple class with superclass', function (done) {
		helper.generate(helper.getFixture('simple_class_with_superclass.h'), helper.getTempFile('class.json'), function (err, json, sdk) {
			if (err) {
				return done(err);
			}
			should(json).be.an.object;
			should(sdk).be.an.object;
			should(json).have.property('metadata');
			should(json).have.property('classes', {
				A: {
					framework: helper.getFixture('simple_class_with_superclass.h'),
					thirdparty: true,
					filename: helper.getFixture('simple_class_with_superclass.h'),
					introducedIn: '0.0.0',
					line: '6',
					name: 'A',
					superclass: 'B'
				},
				B: {
					framework: helper.getFixture('simple_class_with_superclass.h'),
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
		});
	});

	it('should generate simple class with superclass and protocol', function (done) {
		helper.generate(helper.getFixture('simple_class_with_superclass_and_protocol.h'), helper.getTempFile('class.json'), function (err, json, sdk) {
			if (err) {
				return done(err);
			}
			should(json).be.an.object;
			should(sdk).be.an.object;
			should(json).have.property('metadata');
			should(json).have.property('classes', {
				A: {
					framework: helper.getFixture('simple_class_with_superclass_and_protocol.h'),
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
					framework: helper.getFixture('simple_class_with_superclass_and_protocol.h'),
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
					framework: helper.getFixture('simple_class_with_superclass_and_protocol.h'),
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
		});
	});

	it('should generate class with properties', function (done) {
		helper.generate(helper.getFixture('class_with_properties.h'), helper.getTempFile('class_with_properties.json'), function (err, json, sdk) {
			if (err) {
				return done(err);
			}
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
					framework: helper.getFixture('class_with_properties.h'),
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
		});
	});

	it('should generate class with categories', function (done) {
		helper.generate(helper.getFixture('class_with_category.h'), helper.getTempFile('class_with_category.json'), function (err, json, sdk) {
			if (err) {
				return done(err);
			}
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
					filename: helper.getFixture('class_with_category.h'),
					framework: helper.getFixture('class_with_category.h'),
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
		}, true);
	});
});

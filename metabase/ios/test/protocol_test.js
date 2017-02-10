var assert = require('assert'),
	rewire = require('rewire'),
	should = require('should'),
	helper = require('./helper');

describe('protocol', function () {

	it('should generate empty protocol', function (done) {
		helper.generate(helper.getFixture('empty_protocol.h'), helper.getTempFile('protocol.json'), function (err, json, sdk) {
			if (err) { return done(err); }
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
			should(json.metadata).have.property('min-version', sdk.version);
			should(json.metadata).have.property('sdk-path', sdk.sdkdir);
			should(json.metadata).have.property('platform', 'ios');
			should(json.metadata.generated).match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2,}Z/);
			done();
		});
	});

	it('should generate simple protocol', function (done) {
		helper.generate(helper.getFixture('simple_protocol.h'), helper.getTempFile('protocol.json'), function (err, json, sdk) {
			if (err) { return done(err); }
			should(json).be.an.object;
			should(sdk).be.an.object;
			should(json).have.property('metadata');
			should(json).have.property('protocols', {
				A: {
					framework: 'fixtures',
					thirdparty: true,
					filename: helper.getFixture('simple_protocol.h'),
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
			should(json.metadata).have.property('min-version', sdk.version);
			should(json.metadata).have.property('sdk-path', sdk.sdkdir);
			should(json.metadata).have.property('platform', 'ios');
			should(json.metadata.generated).match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2,}Z/);
			done();
		});
	});

	it('should generate simple protocol with optional property', function (done) {
		helper.generate(helper.getFixture('simple_protocol_with_optional_property.h'), helper.getTempFile('protocol.json'), function (err, json, sdk) {
			if (err) { return done(err); }
			should(json).be.an.object;
			should(sdk).be.an.object;
			should(json).have.property('metadata');
			should(json).have.property('protocols', {
				A: {
					framework: 'fixtures',
					thirdparty: true,
					filename: helper.getFixture('simple_protocol_with_optional_property.h'),
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
			should(json.metadata).have.property('min-version', sdk.version);
			should(json.metadata).have.property('sdk-path', sdk.sdkdir);
			should(json.metadata).have.property('platform', 'ios');
			should(json.metadata.generated).match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2,}Z/);
			done();
		});
	});

	it('should generate simple protocol with required property', function (done) {
		helper.generate(helper.getFixture('simple_protocol_with_required_property.h'), helper.getTempFile('protocol.json'), function (err, json, sdk) {
			if (err) { return done(err); }
			should(json).be.an.object;
			should(sdk).be.an.object;
			should(json).have.property('metadata');
			should(json).have.property('protocols', {
				A: {
					framework: 'fixtures',
					thirdparty: true,
					filename: helper.getFixture('simple_protocol_with_required_property.h'),
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
			should(json.metadata).have.property('min-version', sdk.version);
			should(json.metadata).have.property('sdk-path', sdk.sdkdir);
			should(json.metadata).have.property('platform', 'ios');
			should(json.metadata.generated).match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2,}Z/);
			done();
		});
	});

	it('should generate simple protocol with required property and class method', function (done) {
		helper.generate(helper.getFixture('simple_protocol_with_required_method.h'), helper.getTempFile('protocol.json'), function (err, json, sdk) {
			if (err) { return done(err); }
			should(json).be.an.object;
			should(sdk).be.an.object;
			should(json).have.property('metadata');
			should(json).have.property('protocols', {
				A: {
					framework: 'fixtures',
					thirdparty: true,
					filename: helper.getFixture('simple_protocol_with_required_method.h'),
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
			should(json.metadata).have.property('min-version', sdk.version);
			should(json.metadata).have.property('sdk-path', sdk.sdkdir);
			should(json.metadata).have.property('platform', 'ios');
			should(json.metadata.generated).match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2,}Z/);
			done();
		});
	});

	it('should merge incorporated protocol methods and properties', function(done) {
		helper.generate(helper.getFixture('protocol_inheritance.h'), helper.getTempFile('protocol.json'), function (err, json, sdk) {
			assert.ifError(err);

			var baseProtocol = {
				filename: helper.getFixture('protocol_inheritance.h'),
				framework: 'fixtures',
				line: '1',
				methods: {
					a: {
						arguments: [],
						encoding: 'f16@0:8',
						instance: true,
						name: 'a',
						returns: { encoding: 'f', type: 'float', value: 'float' },
						selector: 'a'
					},
					b: {
						arguments: [],
						encoding: 'v16@0:8',
						instance: true,
						name: 'b',
						returns: { encoding: 'v', type: 'void', value: 'void' },
						selector: 'b'
					},
					'setA:': {
						arguments: [
							{ encoding: 'f', name: 'a', type: 'float', value: 'float' }
						],
						encoding: 'v20@0:8f16',
						instance: true,
						name: 'setA',
						returns: { encoding: 'v', type: 'void', value: 'void' },
						selector: 'setA:'
					}
				},
				name: 'BaseProtocol',
				properties: {
					a: {
						name: 'a',
						optional: false,
						type: { type: 'float', value: 'float' }
					}
				},
				thirdparty: true
			};
			should(json).have.property('protocols', {
		    BaseProtocol: baseProtocol,
		    MyProtocol: {
		      filename: helper.getFixture('protocol_inheritance.h'),
		      framework: 'fixtures',
		      line: '8',
		      methods: {
		        c: {
		          arguments: [],
		          encoding: 'v16@0:8',
		          instance: true,
		          name: 'c',
		          returns: { encoding: 'v', type: 'void', value: 'void' },
		          selector: 'c'
		        }
		      },
		      name: 'MyProtocol',
		      protocols: [ 'BaseProtocol' ],
		      thirdparty: true
		    }
			});

			var generate = rewire('../lib/generate/index');
			var processIncorporatedProtocols = generate.__get__('processIncorporatedProtocols');
			processIncorporatedProtocols(json.protocols);
			should(json).have.property('protocols', {
				BaseProtocol: baseProtocol,
				MyProtocol: {
		      filename: helper.getFixture('protocol_inheritance.h'),
		      framework: 'fixtures',
		      line: '8',
					methods: {
			      a: {
			        arguments: [],
			        encoding: 'f16@0:8',
			        instance: true,
			        name: 'a',
			        returns: { encoding: 'f', type: 'float', value: 'float' },
			        selector: 'a'
			      },
			      b: {
			        arguments: [],
			        encoding: 'v16@0:8',
			        instance: true,
			        name: 'b',
			        returns: { encoding: 'v', type: 'void', value: 'void' },
			        selector: 'b'
			      },
			      c: {
			        arguments: [],
			        encoding: 'v16@0:8',
			        instance: true,
			        name: 'c',
			        returns: { encoding: 'v', type: 'void', value: 'void' },
			        selector: 'c'
			      },
			      'setA:': {
			        arguments: [
			          { encoding: 'f', name: 'a', type: 'float', value: 'float' }
			        ],
			        encoding: 'v20@0:8f16',
			        instance: true,
			        name: 'setA',
			        returns: { encoding: 'v', type: 'void', value: 'void' },
			        selector: 'setA:'
			      }
			    },
			    name: 'MyProtocol',
			    properties: {
			      a: {
			        name: 'a',
			        optional: false,
			        type: { type: 'float', value: 'float' }
			      }
			    },
			    protocols: [ 'BaseProtocol' ],
			    thirdparty: true
		    }
			});

			done();
		});
	});
});

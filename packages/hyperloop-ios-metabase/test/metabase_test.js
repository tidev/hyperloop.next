/* eslint-disable no-unused-expressions */
'use strict';

const should = require('should'),
	path = require('path'),
	metabase = require('../lib/metabase'),
	SDKEnvironment = require('../lib/sdk').SDKEnvironment;

describe('metabase', () => {
	const tmpDir = path.join(__dirname, 'tmp');
	let systemFrameworks = new Map();
	let sdk;
	const minVersion = '9.0';

	before(done => {
		// Shut the logger up!
		require('../lib/util').setLog({ trace: function () {} });
		SDKEnvironment.fromTypeAndMinimumVersion('iphonesimulator', '9.0')
			.then(sdkInfo => {
				sdk = sdkInfo;
				return sdk.getSystemFrameworks();
			})
			.then(frameworkMap => {
				systemFrameworks = frameworkMap;
				done();
			})
			.catch(err => done(err));
	});

	describe('#merge', () => {
		it('should merge two metabase objects', () => {
			const targetMetabase = {
				classes: {
					MySecondClass: {}
				},
				enums: {
					MyEnum: {
						name: 'original'
					}
				},
				vars: {
					MyVar: {}
				}
			};
			const srcMetabase = {
				classes: {
					MyClass: {

					}
				},
				enums: {
					MyEnum: {
						name: 'new',
						extra: true
					}
				},
				protocols: {
					MyProtocol: {}
				}
			};
			const result = metabase.merge(targetMetabase, srcMetabase);
			result.should.have.property('classes');
			result.classes.should.have.property('MyClass');
			result.classes.should.have.property('MySecondClass');
			result.should.have.property('enums');
			result.enums.should.have.property('MyEnum');
			result.enums.MyEnum.name.should.eql('original');
			result.enums.MyEnum.should.not.have.property('extra');
			result.should.have.property('vars');
			result.vars.should.have.property('MyVar');
			result.should.have.property('protocols');
			result.protocols.should.have.property('MyProtocol');
		});

		it('should merge into empty object', () => {
			const targetMetabase = {};
			const srcMetabase = {
				classes: {
					MyClass: {

					}
				},
				enums: {
					MyEnum: {
						name: 'new',
						extra: true
					}
				},
				protocols: {
					MyProtocol: {}
				}
			};
			const result = metabase.merge(targetMetabase, srcMetabase);
			result.should.have.property('classes');
			result.classes.should.have.property('MyClass');
			result.should.have.property('enums');
			result.enums.should.have.property('MyEnum');
			result.enums.MyEnum.should.have.property('name');
			result.enums.MyEnum.name.should.eql('new');
			result.enums.MyEnum.should.have.property('extra');
			result.should.not.have.property('vars'); // it's not in src, so doesn't get created in target
			result.should.have.property('protocols');
			result.protocols.should.have.property('MyProtocol');
		});
	});

	// Add a new method to generate a single framework's metabase on the fly!
	describe('#generateFrameworkMetabase()', () => {
		it('should generate metabase for a single framework', () => {
			metabase.generateFrameworkMetabase(tmpDir, sdk.sdkPath, minVersion, systemFrameworks.get('UIKit'), (err, json) => {
				should(err).not.be.ok;
				should(json).be.ok;

				json.classes.should.not.have.property('CAAnimation'); // Don't include QuartzCore class
				json.classes.should.have.property('UILabel'); // Does have class from UIKit
				// Contains dependencies in the metadata
				json.metadata.should.have.property('dependencies');
				// Contains an array of header paths we skipped
				json.metadata.dependencies.should.containEql(path.join(sdk.sdkPath, 'System/Library/Frameworks/QuartzCore.framework/Headers/CAAnimation.h'));
			});
		});

		it('should generate NSObject from Foundation framework', () => {
			metabase.generateFrameworkMetabase(tmpDir, sdk.sdkPath, minVersion, systemFrameworks.get('Foundation'), (err, json) => {
				should(err).not.be.ok;
				should(json).be.ok;

				json.classes.should.have.property('NSObject');
				json.protocols.should.have.property('NSObject');
			});
		});

		it('should include system types in CoreFoundation framework', () => {
			metabase.generateFrameworkMetabase(tmpDir, sdk.sdkPath, minVersion, systemFrameworks.get('CoreFoundation'), (err, json) => {
				should(err).not.be.ok;
				should(json).be.ok;

				json.typedefs.should.have.property('BOOL');
				json.typedefs.should.have.property('Boolean');
				json.typedefs.should.have.property('Byte');
				json.typedefs.should.have.property('Class');
				json.typedefs.should.have.property('Float32');
				json.typedefs.should.have.property('Float64');
			});
		});
	});
});

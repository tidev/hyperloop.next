/* eslint-disable no-unused-expressions */
'use strict';

const path = require('path');
const should = require('should'); // eslint-disable-line no-unused-vars
const metadata = require('../lib/module_metadata');
const SDKEnvironment = require('../lib/sdk').SDKEnvironment;

describe('module metadata', () => {
	describe('#appleVersionToSemver()', () => {
		it('should handle single-segment versions', () => {
			metadata.appleVersionToSemver('9').should.eql('9.0.0');
		});

		it('should handle two-segment versions', () => {
			metadata.appleVersionToSemver('9.0').should.eql('9.0.0');
		});

		it('should handle Number versions', () => {
			metadata.appleVersionToSemver(9).should.eql('9.0.0');
		});
	});

	// Add a new method to generate a single framework's metabase on the fly!
	describe('#generateMetabase()', () => {
		const tmpDir = path.join(__dirname, 'tmp');
		let systemFrameworks = new Map();
		let sdk;

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

		it('should generate metabase for a single framework', (done) => {
			systemFrameworks.get('UIKit').generateMetabase(tmpDir, sdk)
				.then(json => {
					should(json).be.ok;

					json.classes.should.not.have.property('CAAnimation'); // Don't include QuartzCore class
					json.classes.should.have.property('UILabel'); // Does have class from UIKit
					// Contains dependencies in the metadata
					json.metadata.should.have.property('dependencies');
					// Contains an array of header paths we skipped
					json.metadata.dependencies.should.containEql(path.join(sdk.sdkPath, 'System/Library/Frameworks/QuartzCore.framework/Headers/CAAnimation.h'));
					done();
				})
				.catch(err => done(err));
		});

		it('should generate NSObject from Foundation framework', (done) => {
			systemFrameworks.get('Foundation').generateMetabase(tmpDir, sdk)
				.then(json => {
					should(json).be.ok;

					json.classes.should.have.property('NSObject');
					json.protocols.should.have.property('NSObject');
					done();
				})
				.catch(err => done(err));
		});

		it('should include system types in CoreFoundation framework', (done) => {
			systemFrameworks.get('CoreFoundation').generateMetabase(tmpDir, sdk)
				.then(json => {
					should(json).be.ok;

					json.typedefs.should.have.property('BOOL');
					json.typedefs.should.have.property('Boolean');
					json.typedefs.should.have.property('Byte');
					json.typedefs.should.have.property('Class');
					json.typedefs.should.have.property('Float32');
					json.typedefs.should.have.property('Float64');
					done();
				})
				.catch(err => done(err));
		});
	});
});

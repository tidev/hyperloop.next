/* eslint-disable no-unused-expressions */
'use strict';

const should = require('should'),
	path = require('path'),
	frameworks = require('../lib/frameworks'),
	metabase = require('../lib/metabase');

describe('metabase', function () {
	const tmpDir = path.join(__dirname, 'tmp');

	describe('#generateMetabase()', function () {
		it('should generate metabase for a given header and all dependencies', function () {
			frameworks.getSystemFrameworks(tmpDir, 'iphonesimulator', '9.0', function (err, frameworkMap) {
				const sdkPath = frameworkMap.get('$metadata').sdkPath;
				// Include UIKit's "umbrella" header
				const includes = [ path.join(sdkPath, 'System/Library/Frameworks/UIKit.framework/Headers/UIKit.h') ];
				metabase.generateMetabase(tmpDir, frameworkMap.get('$metadata').sdkType, sdkPath, frameworkMap.get('$metadata').minVersion, includes, false, function (err, json) {
					should(err).not.be.ok;
					should(json).be.ok;

					// console.log(JSON.stringify(json));
					should(json.classes).have.property('CAAnimation');
					// FIXME This pulls in UIKit, but also other frameworks it depends upon like QuartzCore
					// Can we generate a metabase per-framework without "polluting" it with dependencies?
					// We could post-process to remove any entries whose framework value doesn't match
					// But do we then need to track the framework's dependencies in some way?
				}, true);
			});
		});
	});

	// Add a new method to generate a single framework's metabase on the fly!
	describe('#generateFrameworkMetabase()', function () {
		it('should generate metabase for a single framework', function () {
			frameworks.getSystemFrameworks(tmpDir, 'iphonesimulator', '9.0', function (err, frameworkMap) {
				metabase.generateFrameworkMetabase(tmpDir, frameworkMap.get('$metadata').sdkPath, frameworkMap.get('$metadata').minVersion, frameworkMap.get('UIKit'), function (err, json) {
					should(err).not.be.ok;
					should(json).be.ok;

					json.classes.should.not.have.property('CAAnimation'); // Don't include QuartzCore class
					json.classes.should.have.property('UILabel'); // Does have class from UIKit
					// Contains dependencies in the metadata
					json.metadata.should.have.property('dependencies');
					// Contains an array of header paths we skipped
					json.metadata.dependencies.should.containEql(path.join(frameworkMap.get('$metadata').sdkPath, 'System/Library/Frameworks/QuartzCore.framework/Headers/CAAnimation.h'));
				});
			});
		});
	});
});

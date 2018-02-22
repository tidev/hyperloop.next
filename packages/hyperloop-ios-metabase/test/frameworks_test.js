/* eslint-disable no-unused-expressions */
'use strict';

const should = require('should'), // eslint-disable-line no-unused-vars
	path = require('path'),
	frameworks = require('../lib/frameworks');

describe('frameworks', function () {
	const tmpDir = path.join(__dirname, 'tmp');

	describe('#getSystemFrameworks()', function () {
		it('should do something', function (done) {
			// Shut the logger up!
			require('../lib/util').setLog({ trace: function () {} });
			frameworks.getSDKPath('iphonesimulator', (err, sdkPath) => {
				frameworks.getSystemFrameworks(tmpDir, sdkPath, function (err, map) {
					if (err) {
						return done(err);
					}

					map.has('UIKit').should.be.true;
					map.has('Foundation').should.be.true;
					// TODO Verify frameworks has.... Foundation? UIKit? Some basic stuff?
					done();
				});
			});
		});
	});

	describe('#appleVersionToSemver()', function () {
		it('should handle single-segment versions', function () {
			frameworks.appleVersionToSemver('9').should.eql('9.0.0');
		});

		it('should handle two-segment versions', function () {
			frameworks.appleVersionToSemver('9.0').should.eql('9.0.0');
		});

		it('should handle Number versions', function () {
			frameworks.appleVersionToSemver(9).should.eql('9.0.0');
		});
	});
});

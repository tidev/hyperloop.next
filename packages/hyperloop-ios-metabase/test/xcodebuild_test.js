'use strict';

const should = require('should'), // eslint-disable-line no-unused-vars
	spawn = require('child_process').spawn; // eslint-disable-line security/detect-child-process

describe('xcodebuild', function () {

	it('should run unit tests', function (done) {
		var child = spawn('xcodebuild', [ 'test', '-scheme', 'unittest' ]);
		child.on('error', done);
		// child.stdout.on('data', function (buf) {
		// 	process.stdout.write(buf);
		// });
		child.stderr.on('data', function (buf) {
			process.stderr.write(buf);
		});
		child.on('close', function (ec) {
			if (ec !== 0) {
				return done(new Error('xcodebuild unit tests failed'));
			}
			done();
		});
	});

});

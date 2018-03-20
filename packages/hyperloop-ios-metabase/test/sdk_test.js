/* eslint-disable no-unused-expressions */
'use strict';

const should = require('should'); // eslint-disable-line no-unused-vars
const SDKEnvironment = require('../lib/sdk').SDKEnvironment;

describe('sdk', function () {

	describe('#getSystemFrameworks()', function () {
		it('should detect common System Frameworks like Foundation and UIKit', function (done) {
			// Shut the logger up!
			require('../lib/util').setLog({ trace: function () {} });
			SDKEnvironment.fromTypeAndMinimumVersion('iphonesimulator', '9.0').then(
				sdk => {
					sdk.getSystemFrameworks().then(
						map => {
							map.has('UIKit').should.be.true;
							map.has('Foundation').should.be.true;
							// TODO Verify metadata gathered?
							done();
						},
						err => done(err)
					);
				},
				err => done(err)
			);
		});
	});
});

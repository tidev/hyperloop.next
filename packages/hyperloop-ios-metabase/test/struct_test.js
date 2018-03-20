/* eslint-disable no-unused-expressions */
'use strict';

const should = require('should'),
	helper = require('./helper');

describe('struct', function () {

	it('should generate structs', function (done) {
		helper.generate(helper.getFixture('struct.h'), helper.getTempFile('struct.json'), function (err, json, sdk) {
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
			should(json).have.property('structs', {
				A: {
					fields: [
						{
							encoding: 'f',
							name: 'a',
							type: 'float'
						}
					],
					framework: helper.getFixture('struct.h'),
					thirdparty: true,
					introducedIn: '0.0.0',
					filename: helper.getFixture('struct.h'),
					line: '1',
					name: 'A'
				},
				B: {
					framework: helper.getFixture('struct.h'),
					thirdparty: true,
					introducedIn: '0.0.0',
					filename: helper.getFixture('struct.h'),
					line: '2',
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

});

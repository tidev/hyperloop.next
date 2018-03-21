/* eslint-disable no-unused-expressions */
'use strict';

const should = require('should'), // eslint-disable-line no-unused-vars
	metadata = require('../lib/module_metadata');

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
});

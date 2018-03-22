/* eslint-env node, mocha */
/* eslint no-unused-expressions: "off" */
'use strict';

const should = require('should'); // eslint-disable-line no-unused-vars
const genenum = require('../generate/enum');

describe('generate/enum', () => {

	it('generates expected data structure for filling template', () => {
		const result = genenum.generate('UIControlState', {
			filename: '/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneSimulator.platform/Developer/SDKs/iPhoneSimulator11.2.sdk/System/Library/Frameworks/UIKit.framework/Headers/UIControl.h',
			framework: 'UIKit',
			introducedIn: '0.0.0',
			line: '56',
			thirdparty: true,
			values:
			{
				UIControlStateApplication: 16711680,
				UIControlStateDisabled: 2,
				UIControlStateFocused: 8,
				UIControlStateHighlighted: 1,
				UIControlStateNormal: 0,
				UIControlStateReserved: 4278190080,
				UIControlStateSelected: 4
			}
		});
		result.should.have.property('enumObj');
		result.enumObj.should.have.property('name');
		result.enumObj.name.should.eql('UIControlState');
		result.enumObj.should.have.property('values');
		result.enumObj.values.should.have.property('Application');
		result.enumObj.values.should.have.property('Disabled');
		result.enumObj.values.should.have.property('Focused');
		result.should.have.property('framework');
		result.framework.should.eql('UIKit');
		result.should.have.property('filename');
	});
});

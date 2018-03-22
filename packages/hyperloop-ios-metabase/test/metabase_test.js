/* eslint-disable no-unused-expressions */
'use strict';

const should = require('should');  // eslint-disable-line no-unused-vars
const metabase = require('../lib/metabase');

describe('metabase', () => {
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
});

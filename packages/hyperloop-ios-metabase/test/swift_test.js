/* eslint-disable no-unused-expressions */
'use strict';

const should = require('should'),
	path = require('path'),
	helper = require('./helper'),
	swift = require('../lib/swift'),
	metabase = require('../lib/metabase'),
	SDKEnvironment = require('../lib/sdk').SDKEnvironment;

describe('swift', function () {
	const tmpdir = path.join(__dirname, 'tmp'); // Re-use same cache dir for the suite
	let sdk;

	this.timeout(10000);

	before(function (done) {
		this.timeout(20000);
		// turn off trace logging
		// require('../lib/util').setLog({ trace: () => {} });
		SDKEnvironment.fromTypeAndMinimumVersion('iphonesimulator', '9.0')
			.then(sdkInfo => {
				sdk = sdkInfo;
				return sdk.getSystemFrameworks();
			})
			.then(frameworks => {
				// Pre-generate a unified metabase for UIKit and dependencies
				return metabase.unifiedMetabase(sdk, frameworks, [ 'UIKit' ]);
			})
			.then(() => { done(); })
			.catch(err => done(err));
	});

	function generateSwiftFrameworkMetabase(frameworkName, files) {
		const swiftSources = files.map(f => {
			return {
				framework: frameworkName,
				source: f
			};
		});
		return swift.generateSwiftFrameworks(swiftSources)
			.then(map => {
				return map.get(frameworkName).generateMetabase(sdk);
			});
	}

	it('should generate swift class', done => {
		const frameworkName = 'Swift';
		const swiftFile = helper.getFixture('simple_class.swift');
		generateSwiftFrameworkMetabase(frameworkName, [ swiftFile ])
			.then(result => {
				should(result).be.an.object;
				should(result).have.property('imports');
				should(result).have.property('classes');
				should(result.imports).be.eql([ 'UIKit' ]);
				should(result.classes).have.property('MyUI');
				should(result.classes.MyUI).have.property('name', 'MyUI');
				should(result.classes.MyUI).have.property('superclass', 'UIView');
				should(result.classes.MyUI).have.property('language', 'swift');
				should(result.classes.MyUI).have.property('framework', frameworkName);
				should(result.classes.MyUI).have.property('filename', swiftFile);
				should(result.classes.MyUI).have.property('thirdparty', true);
				should(result.classes.MyUI).have.property('methods', {});
				should(result.classes.MyUI).have.property('properties', {});
				done();
			})
			.catch(err => done(err));
	});

	it('should not generate private swift class', done => {
		const frameworkName = 'Swift';
		const swiftFile = helper.getFixture('private_class.swift');
		generateSwiftFrameworkMetabase(frameworkName, [ swiftFile ])
			.then(result => {
				should(result).be.an.object;
				should(result.imports).be.eql([ 'UIKit' ]);
				should(result).have.property('classes', {});
				done();
			})
			.catch(err => done(err));
	});

	it('should handle syntax error', done => {
		const frameworkName = 'Swift';
		const swiftFile = helper.getFixture('syntaxerror.swift');
		generateSwiftFrameworkMetabase(frameworkName, [ swiftFile ])
			.then(() => {
				done(new Error('should have failed with syntax error!'));
			})
			.catch(err => {
				should(err).be.ok;
				should(err.message).be.equal('Swift file at ' + helper.getFixture('syntaxerror.swift') + ' has compiler problems. Please check to make sure it compiles OK.');
				done();
			});
	});

	// FIXME: CGRectMake is explicitly unavailable
	it('should generate swift class with functions', done => { // eslint-disable-line
		const frameworkName = 'Swift';
		const swiftFile = helper.getFixture('class_functions.swift');
		generateSwiftFrameworkMetabase(frameworkName, [ swiftFile ])
			.then(result => {
				should(result).be.an.object;
				should(result).have.property('imports');
				should(result).have.property('classes');
				should(result.imports).be.eql([ 'UIKit', 'Foundation' ]);
				should(result.classes).have.property('MyUI');
				should(result.classes.MyUI).have.property('name', 'MyUI');
				should(result.classes.MyUI).have.property('superclass', 'UIView');
				should(result.classes.MyUI).have.property('language', 'swift');
				should(result.classes.MyUI).have.property('framework', 'Swift');
				should(result.classes.MyUI).have.property('filename', swiftFile);
				should(result.classes.MyUI).have.property('thirdparty', true);
				should(result.classes.MyUI).have.property('methods', {
					add: {
						name: 'add',
						selector: 'add:',
						arguments: [
							{
								name: 'x',
								type: {
									value: 'CGFloat',
									type: 'double',
									encoding: 'd'
								}
							}
						],
						returns: {
							value: 'CGFloat',
							type: 'double',
							encoding: 'd'
						},
						instance: false
					},
					makeRect: {
						name: 'makeRect',
						selector: 'makeRect:height:',
						instance: true,
						returns: {
							value: 'CGRect',
							type: 'CGRect',
							encoding: '{CGRect={CGPoint=dd}{CGSize=dd}}'
						},
						arguments: [
							{
								name: 'width',
								type: {
									value: 'CGFloat',
									type: 'double',
									encoding: 'd'
								}
							},
							{
								name: 'height',
								type: {
									value: 'CGFloat',
									type: 'double',
									encoding: 'd'
								}
							}
						]
					}
				});
				should(result.classes.MyUI).have.property('properties', {});
				done();
			})
			.catch(err => done(err));
	});

	it('should generate swift class with properties', done => {
		const frameworkName = 'Swift';
		const swiftFile = helper.getFixture('class_properties.swift');
		generateSwiftFrameworkMetabase(frameworkName, [ swiftFile ])
			.then(result => {
				should(result).be.an.object;
				should(result).have.property('classes');
				should(result.classes).have.property('MyClassPropertyUI');
				should(result.classes.MyClassPropertyUI).have.property('name', 'MyClassPropertyUI');
				should(result.classes.MyClassPropertyUI).have.property('superclass', 'UIView');
				should(result.classes.MyClassPropertyUI).have.property('language', 'swift');
				should(result.classes.MyClassPropertyUI).have.property('framework', 'Swift');
				should(result.classes.MyClassPropertyUI).have.property('filename', swiftFile);
				should(result.classes.MyClassPropertyUI).have.property('thirdparty', true);
				should(result.classes.MyClassPropertyUI).have.property('methods', {});
				should(result.classes.MyClassPropertyUI).have.property('properties', {
					someProperty: {
						name: 'someProperty',
						type: {
							value: 'double',
							type: 'double',
							encoding: 'd'
						}
					}
				});
				done();
			})
			.catch(err => done(err));
	});

	it('should generate managled class names', () => {
		const value = swift.generateSwiftMangledClassName('a', 'b');
		should(value).be.equal('_TtC1a1b');
	});

	it('should generate framework metabase from multiple swift files', function (done) {
		this.timeout(30000);

		const frameworkName = 'Swift';
		const swiftFiles = [ helper.getFixture('simple_class.swift'), helper.getFixture('class_properties.swift') ];
		generateSwiftFrameworkMetabase(frameworkName, swiftFiles)
			.then(result => {
				should(result).be.an.object;
				should(result).have.property('metadata');
				should(result).have.property('classes');

				// 'simple_class.swift'
				should(result.classes).have.property('MyUI');
				should(result.classes.MyUI).have.property('name', 'MyUI');
				should(result.classes.MyUI).have.property('superclass', 'UIView');
				should(result.classes.MyUI).have.property('language', 'swift');
				should(result.classes.MyUI).have.property('framework', 'Swift');
				should(result.classes.MyUI).have.property('filename', helper.getFixture('simple_class.swift'));
				should(result.classes.MyUI).have.property('thirdparty', true);
				should(result.classes.MyUI).have.property('methods', {});
				should(result.classes.MyUI).have.property('properties', {});

				// class_properties.swift
				should(result.classes).have.property('MyClassPropertyUI');
				should(result.classes.MyClassPropertyUI).have.property('name', 'MyClassPropertyUI');
				should(result.classes.MyClassPropertyUI).have.property('superclass', 'UIView');
				should(result.classes.MyClassPropertyUI).have.property('language', 'swift');
				should(result.classes.MyClassPropertyUI).have.property('framework', 'Swift');
				should(result.classes.MyClassPropertyUI).have.property('filename', helper.getFixture('class_properties.swift'));
				should(result.classes.MyClassPropertyUI).have.property('thirdparty', true);
				should(result.classes.MyClassPropertyUI).have.property('methods', {});
				should(result.classes.MyClassPropertyUI).have.property('properties', {
					someProperty: {
						name: 'someProperty',
						type: {
							value: 'double',
							type: 'double',
							encoding: 'd'
						}
					}
				});

				done();
			})
			.catch(err => done(err));
	});
});

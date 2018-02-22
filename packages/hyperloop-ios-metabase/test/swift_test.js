/* eslint-disable no-unused-expressions */
'use strict';

const should = require('should'),
	helper = require('./helper'),
	swift = require('../lib/swift'),
	frameworks = require('../lib/frameworks'),
	metabase = require('../lib/metabase');

describe('swift', function () {
	let json,
		sdkdir,
		frameworkMap;

	before(function (done) {
		this.timeout(20000);
		// turn off trace logging
		require('../lib/util').setLog({ trace: function () {} });
		helper.getSimulatorSDK(function (err, sdk) {
			if (err) {
				return done(err);
			}
			sdkdir = sdk.sdkdir;
			var tmpdir = helper.getTempDir();
			frameworks.getSystemFrameworks(tmpdir, sdkdir, function (err, frameworks) {
				if (err) {
					return done(err);
				}
				frameworkMap = frameworks;
				metabase.generateMetabase(tmpdir, 'iphonesimulator', sdkdir, sdk.version, [ '<Foundation/Foundation.h>', '<UIKit/UIKit.h>' ], false, function (err, json_) {
					if (err) {
						return done(err);
					}
					json = json_;
					done();
				});
			});
		});
	});

	it('should generate swift class', function (done) {
		swift.generateSwiftMetabase(helper.getTempDir(), 'iphonesimulator', sdkdir, '9.0', 'iphonesimulator', json, 'Swift', helper.getFixture('simple_class.swift'), function (err, result) {
			should(err).not.be.ok;
			should(result).be.an.object;
			should(result).have.property('imports');
			should(result).have.property('classes');
			should(result).have.property('filename', helper.getFixture('simple_class.swift'));
			should(result.imports).be.eql([ 'UIKit' ]);
			should(result.classes).have.property('MyUI');
			should(result.classes.MyUI).have.property('name', 'MyUI');
			should(result.classes.MyUI).have.property('superclass', 'UIView');
			should(result.classes.MyUI).have.property('language', 'swift');
			should(result.classes.MyUI).have.property('framework', 'Swift');
			should(result.classes.MyUI).have.property('filename', helper.getFixture('simple_class.swift'));
			should(result.classes.MyUI).have.property('thirdparty', true);
			should(result.classes.MyUI).have.property('methods', {});
			should(result.classes.MyUI).have.property('properties', {});
			done();
		});
	});

	it('should not generate private swift class', function (done) {
		swift.generateSwiftMetabase(helper.getTempDir(), 'iphonesimulator', sdkdir, '9.0', 'iphonesimulator', json, 'Swift', helper.getFixture('private_class.swift'), function (err, result) {
			should(err).not.be.ok;
			should(result).be.an.object;
			should(result.imports).be.eql([ 'UIKit' ]);
			should(result).have.property('classes', {});
			should(result).have.property('filename', helper.getFixture('private_class.swift'));
			done();
		});
	});

	it('should handle syntax error', function (done) {
		swift.generateSwiftMetabase(helper.getTempDir(), 'iphonesimulator', sdkdir, '9.0', 'iphonesimulator', json, 'Swift', helper.getFixture('syntaxerror.swift'), function (err) {
			should(err).be.ok;
			should(err.message).be.equal('Swift file at ' + helper.getFixture('syntaxerror.swift') + ' has compiler problems. Please check to make sure it compiles OK.');
			done();
		});
	});

	// FIXME: CGRectMake is explicitly unavailable
	it.skip('should generate swift class with functions', function (done) { // eslint-disable-line
		swift.generateSwiftMetabase(helper.getTempDir(), 'iphonesimulator', sdkdir, '9.0', 'iphonesimulator', json, 'Swift', helper.getFixture('class_functions.swift'), function (err, result) {
			should(err).not.be.ok;
			should(result).be.an.object;
			should(result).have.property('imports');
			should(result).have.property('classes');
			should(result).have.property('filename', helper.getFixture('class_functions.swift'));
			should(result.imports).be.eql([ 'UIKit', 'Foundation' ]);
			should(result.classes).have.property('MyUI');
			should(result.classes.MyUI).have.property('name', 'MyUI');
			should(result.classes.MyUI).have.property('superclass', 'UIView');
			should(result.classes.MyUI).have.property('language', 'swift');
			should(result.classes.MyUI).have.property('framework', 'Swift');
			should(result.classes.MyUI).have.property('filename', helper.getFixture('class_functions.swift'));
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
		});
	});

	it('should generate swift class with properties', function (done) {
		swift.generateSwiftMetabase(helper.getTempDir(), 'iphonesimulator', sdkdir, '9.0', 'iphonesimulator', json, 'Swift', helper.getFixture('class_properties.swift'), function (err, result) {
			should(err).not.be.ok;
			should(result).be.an.object;
			should(result).have.property('imports');
			should(result).have.property('classes');
			should(result).have.property('filename', helper.getFixture('class_properties.swift'));
			should(result.imports).be.eql([ 'UIKit' ]);
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
		});
	});

	it('should generate managled class names', function () {
		const value = swift.generateSwiftMangledClassName('a', 'b');
		should(value).be.equal('_TtC1a1b');
	});

	it('should generate framework metabase from multiple swift files', function (done) {
		this.timeout(30000);
		const swiftFiles = [ helper.getFixture('simple_class.swift'), helper.getFixture('class_properties.swift') ];
		swift.generateSwiftFrameworkMetabase('Swift', frameworkMap, helper.getTempDir(), sdkdir, '9.0', 'iphonesimulator', swiftFiles, function (err, result) {
			should(err).not.be.ok;

			console.log(JSON.stringify(result));
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
		});
	});

});

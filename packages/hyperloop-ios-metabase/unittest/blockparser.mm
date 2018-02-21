/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015 by Appcelerator, Inc.
 */

#import <XCTest/XCTest.h>
#import <string>
#import <vector>
#import "util.h"
#import "parser.h"
#import "typedef.h"

@interface blockparser : XCTestCase

@end

@implementation blockparser

- (void)testSimpleBlock {
	std::vector<std::string> args;
	std::string returns = hyperloop::parseBlock("void (^)(void)", args);
	XCTAssertTrue(returns == "void");
	XCTAssertTrue(args.size() == 0);
}

- (void)testBlockWithArg {
	std::vector<std::string> args;
	std::string returns = hyperloop::parseBlock("void (^)(int)", args);
	XCTAssertTrue(returns == "void");
	XCTAssertTrue(args.size() == 1);
	XCTAssertTrue(args.at(0) == "int");
}

- (void)testReturnsBlock {
	std::vector<std::string> args;
	std::string returns = hyperloop::parseBlock("void (^(^)(NSString *))(void)", args);
	XCTAssertTrue(returns == "void (^)(void)");
	XCTAssertTrue(args.size() == 1);
	XCTAssertTrue(args.at(0) == "NSString *");
}

- (void)testBlockWithBlockAsArg {
	std::vector<std::string> args;
	std::string returns = hyperloop::parseBlock("NSError * (^)(NSString *, BOOL(^)(int))", args);
	XCTAssertTrue(returns == "NSError *");
	XCTAssertTrue(args.size() == 2);
	XCTAssertTrue(args.at(0) == "NSString *");
	XCTAssertTrue(args.at(1) == "BOOL(^)(int)");
}

- (void)testBlockWithProtocolAsArg {
	std::vector<std::string> args;
	std::string returns = hyperloop::parseBlock("void (^)(void (^)(id<NSSecureCoding>,NSError *), Class, NSDictionary *)", args);
	XCTAssertTrue(returns == "void");
	XCTAssertTrue(args.size() == 3);
	XCTAssertTrue(args.at(0) == "void (^)(id<NSSecureCoding>,NSError *)");
	XCTAssertTrue(args.at(1) == "Class");
	XCTAssertTrue(args.at(2) == "NSDictionary *");
}

- (void)testBlockWithProtocolAsArgWithSpaces {
	std::vector<std::string> args;
	std::string returns = hyperloop::parseBlock("void (^)(void (^)(id<NSSecureCoding>, NSError *), Class, NSDictionary *)", args);
	XCTAssertTrue(returns == "void");
	XCTAssertTrue(args.size() == 3);
	XCTAssertTrue(args.at(0) == "void (^)(id<NSSecureCoding>, NSError *)");
	XCTAssertTrue(args.at(1) == "Class");
	XCTAssertTrue(args.at(2) == "NSDictionary *");
}

- (void)testBlockWithMultipleProtocolAsArg {
	std::vector<std::string> args;
	std::string returns = hyperloop::parseBlock("void (^)(NSArray<NSURLSessionDataTask *> *, NSArray<NSURLSessionUploadTask *> *, NSArray<NSURLSessionDownloadTask *> *)", args);
	XCTAssertTrue(returns == "void");
	XCTAssertTrue(args.size() == 3);
	XCTAssertTrue(args.at(0) == "NSArray<NSURLSessionDataTask *> *");
	XCTAssertTrue(args.at(1) == "NSArray<NSURLSessionUploadTask *> *");
	XCTAssertTrue(args.at(2) == "NSArray<NSURLSessionDownloadTask *> *");
}

- (void)testWithProtocolAsLastArg {
	std::vector<std::string> args;
	std::string returns = hyperloop::parseBlock("BOOL (^)(id, NSDictionary<NSString *,id> *)", args);
	XCTAssertTrue(returns == "BOOL");
	XCTAssertTrue(args.size() == 2);
	XCTAssertTrue(args.at(0) == "id");
	XCTAssertTrue(args.at(1) == "NSDictionary<NSString *,id> *");
}

- (void)testSimpleBlockAsJSON {
	hyperloop::ParserContext context("sdk", "9.0", false, "");
	Json::Value json = hyperloop::callbackToJSON(&context, "void (^)(void)");
	XCTAssertTrue(json);
	XCTAssertTrue(json["signature"].asString() == "void (^)(void)");
	XCTAssertTrue(json["type"].asString() == "block");
	XCTAssertTrue(json["encoding"].asString() == "@?");
	Json::Value args = json["arguments"];
	XCTAssertEqual(args.size(), 0);
	Json::Value returns = json["returns"];
	XCTAssertTrue(returns["type"].asString() == "void");
	XCTAssertTrue(returns["value"].asString() == "void");
	XCTAssertTrue(returns["encoding"].asString() == "v");
}

- (void)testBlockWithArgAsJSON {
	hyperloop::ParserContext context("sdk", "9.0", false, "");
	Json::Value json = hyperloop::callbackToJSON(&context, "void (^)(int)");
	XCTAssertTrue(json);
	XCTAssertTrue(json["signature"].asString() == "void (^)(int)");
	XCTAssertTrue(json["type"].asString() == "block");
	XCTAssertTrue(json["encoding"].asString() == "@?");
	Json::Value args = json["arguments"];
	XCTAssertEqual(args.size(), 1);
	Json::Value arg = args[0];
	XCTAssertTrue(arg["type"].asString() == "int");
	XCTAssertTrue(arg["value"].asString() == "int");
	XCTAssertTrue(arg["encoding"].asString() == "i");
	Json::Value returns = json["returns"];
	XCTAssertTrue(returns["type"].asString() == "void");
	XCTAssertTrue(returns["value"].asString() == "void");
	XCTAssertTrue(returns["encoding"].asString() == "v");
}

- (void)testBlockWithArgAndReturnAsJSON {
	hyperloop::ParserContext context("sdk", "9.0", false, "");
	Json::Value json = hyperloop::callbackToJSON(&context, "int (^)(int)");
	XCTAssertTrue(json);
	XCTAssertTrue(json["signature"].asString() == "int (^)(int)");
	XCTAssertTrue(json["type"].asString() == "block");
	XCTAssertTrue(json["encoding"].asString() == "@?");
	Json::Value args = json["arguments"];
	XCTAssertEqual(args.size(), 1);
	Json::Value arg = args[0];
	XCTAssertTrue(arg["type"].asString() == "int");
	XCTAssertTrue(arg["value"].asString() == "int");
	XCTAssertTrue(arg["encoding"].asString() == "i");
	Json::Value returns = json["returns"];
	XCTAssertTrue(returns["type"].asString() == "int");
	XCTAssertTrue(returns["value"].asString() == "int");
	XCTAssertTrue(returns["encoding"].asString() == "i");
}

- (void)testBlockWithTypedefAsJSON {
	hyperloop::ParserContext context("sdk", "9.0", false, "");
	CXCursor cursor;
	cursor.kind = CXCursor_TypedefDecl;
	auto type = new hyperloop::TypeDefinition(cursor, "dispatch_block_t", &context);
	hyperloop::Type atype(&context, "block", "void (^)(void)");
	type->setType(&atype, "@?");
	context.getParserTree()->addType(type);
	Json::Value json = hyperloop::callbackToJSON(&context, "dispatch_block_t");
	XCTAssertTrue(json);
	XCTAssertTrue(json["signature"].asString() == "dispatch_block_t");
	XCTAssertTrue(json["type"].asString() == "block");
	XCTAssertTrue(json["encoding"].asString() == "@?");
	Json::Value args = json["arguments"];
	XCTAssertEqual(args.size(), 0);
	Json::Value returns = json["returns"];
	XCTAssertTrue(returns["type"].asString() == "void");
	XCTAssertTrue(returns["value"].asString() == "void");
	XCTAssertTrue(returns["encoding"].asString() == "v");
}

@end

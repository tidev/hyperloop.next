/**
 * Hyperloop Metabase Generator
 * Copyright (c) 2015 by Appcelerator, Inc.
 */

#import <XCTest/XCTest.h>
#import <string>
#import <vector>
#import "def.h"
#import "util.h"
#import "parser.h"
#import "typedef.h"
#import "BlockParser.h"

@interface blockparser : XCTestCase

@end

@implementation blockparser

- (void)testSimpleBlock {
    hyperloop::ParserContext context("sdk", "9.0", false, "");
    CXCursor cursor;
    cursor.kind = CXCursor_ParmDecl;
    auto definition = hyperloop::TypeDefinition(cursor, "whatever", &context);
    hyperloop::Type atype(&context, "block", "void (^)(void)");
    auto block = hyperloop::BlockParser::parseBlock(&definition, cursor, &atype);
    XCTAssertTrue(block->getSignature() == "void (^)(void)");
    XCTAssertTrue(block->getArguments().count() == 0);
    XCTAssertTrue(block->getReturnType()->getType() == "void");
    XCTAssertTrue(block->getReturnType()->getValue() == "void");
}

// FIXME: Update tests below. They fail because the hacked cursor we generate is not good enough to be used for traversal!
// Is tehre any way to pass along source code to the APIs and get back a valid CXCursor?
//- (void)testBlockWithArg {
//    hyperloop::ParserContext context("sdk", "9.0", false, "");
//    CXCursor cursor;
//    cursor.kind = CXCursor_ParmDecl;
//    CXCursor next;
//    next.kind = CXCursor_ParmDecl;
//    cursor.data[0] = &next;
//    auto definition = hyperloop::TypeDefinition(cursor, "whatever", &context);
//    hyperloop::Type atype(&context, "block", "void (^)(int)");
//    auto block = hyperloop::BlockParser::parseBlock(&definition, cursor, &atype);
//    XCTAssertTrue(block->getSignature() == "void (^)(int)");
//    XCTAssertTrue(block->getArguments().count() == 1);
//    XCTAssertTrue(block->getArguments().get(0).getType()->getType() == "int");
//}

//- (void)testReturnsBlock {
//    hyperloop::ParserContext context("sdk", "9.0", false, "");
//    CXCursor cursor;
//    cursor.kind = CXCursor_ParmDecl;
//    auto definition = hyperloop::TypeDefinition(cursor, "whatever", &context);
//    hyperloop::Type atype(&context, "block", "void (^(^)(NSString *))(void)");
//    auto block = hyperloop::BlockParser::parseBlock(&definition, cursor, &atype);
//    XCTAssertTrue(block->getSignature() == "void (^(^)(NSString *))(void)");
//    XCTAssertTrue(block->getReturnType()->getType() == "void");
//    XCTAssertTrue(block->getReturnType()->getValue() == "void");
//    XCTAssertTrue(block->getArguments().count() == 1);
//    XCTAssertTrue(block->getArguments().get(0).getType()->getType() == "NSString *");
//}

//- (void)testBlockWithBlockAsArg {
//    std::vector<std::string> args;
//    std::string returns = hyperloop::parseBlock("NSError * (^)(NSString *, BOOL(^)(int))", args);
//    XCTAssertTrue(returns == "NSError *");
//    XCTAssertTrue(args.size() == 2);
//    XCTAssertTrue(args.at(0) == "NSString *");
//    XCTAssertTrue(args.at(1) == "BOOL(^)(int)");
//}
//
//- (void)testBlockWithProtocolAsArg {
//    std::vector<std::string> args;
//    std::string returns = hyperloop::parseBlock("void (^)(void (^)(id<NSSecureCoding>,NSError *), Class, NSDictionary *)", args);
//    XCTAssertTrue(returns == "void");
//    XCTAssertTrue(args.size() == 3);
//    XCTAssertTrue(args.at(0) == "void (^)(id<NSSecureCoding>,NSError *)");
//    XCTAssertTrue(args.at(1) == "Class");
//    XCTAssertTrue(args.at(2) == "NSDictionary *");
//}
//
//- (void)testBlockWithProtocolAsArgWithSpaces {
//    std::vector<std::string> args;
//    std::string returns = hyperloop::parseBlock("void (^)(void (^)(id<NSSecureCoding>, NSError *), Class, NSDictionary *)", args);
//    XCTAssertTrue(returns == "void");
//    XCTAssertTrue(args.size() == 3);
//    XCTAssertTrue(args.at(0) == "void (^)(id<NSSecureCoding>, NSError *)");
//    XCTAssertTrue(args.at(1) == "Class");
//    XCTAssertTrue(args.at(2) == "NSDictionary *");
//}
//
//- (void)testBlockWithMultipleProtocolAsArg {
//    std::vector<std::string> args;
//    std::string returns = hyperloop::parseBlock("void (^)(NSArray<NSURLSessionDataTask *> *, NSArray<NSURLSessionUploadTask *> *, NSArray<NSURLSessionDownloadTask *> *)", args);
//    XCTAssertTrue(returns == "void");
//    XCTAssertTrue(args.size() == 3);
//    XCTAssertTrue(args.at(0) == "NSArray<NSURLSessionDataTask *> *");
//    XCTAssertTrue(args.at(1) == "NSArray<NSURLSessionUploadTask *> *");
//    XCTAssertTrue(args.at(2) == "NSArray<NSURLSessionDownloadTask *> *");
//}
//
//- (void)testWithProtocolAsLastArg {
//    std::vector<std::string> args;
//    std::string returns = hyperloop::parseBlock("BOOL (^)(id, NSDictionary<NSString *,id> *)", args);
//    XCTAssertTrue(returns == "BOOL");
//    XCTAssertTrue(args.size() == 2);
//    XCTAssertTrue(args.at(0) == "id");
//    XCTAssertTrue(args.at(1) == "NSDictionary<NSString *,id> *");
//}
//
//- (void)testSimpleBlockAsJSON {
//    hyperloop::ParserContext context("sdk", "9.0", false, "");
//    Json::Value json = hyperloop::callbackToJSON(&context, "void (^)(void)");
//    XCTAssertTrue(json);
//    XCTAssertTrue(json["signature"].asString() == "void (^)(void)");
//    XCTAssertTrue(json["type"].asString() == "block");
//    XCTAssertTrue(json["encoding"].asString() == "@?");
//    Json::Value args = json["arguments"];
//    XCTAssertEqual(args.size(), 0);
//    Json::Value returns = json["returns"];
//    XCTAssertTrue(returns["type"].asString() == "void");
//    XCTAssertTrue(returns["value"].asString() == "void");
//    XCTAssertTrue(returns["encoding"].asString() == "v");
//}
//
//- (void)testBlockWithArgAsJSON {
//    hyperloop::ParserContext context("sdk", "9.0", false, "");
//    Json::Value json = hyperloop::callbackToJSON(&context, "void (^)(int)");
//    XCTAssertTrue(json);
//    XCTAssertTrue(json["signature"].asString() == "void (^)(int)");
//    XCTAssertTrue(json["type"].asString() == "block");
//    XCTAssertTrue(json["encoding"].asString() == "@?");
//    Json::Value args = json["arguments"];
//    XCTAssertEqual(args.size(), 1);
//    Json::Value arg = args[0];
//    XCTAssertTrue(arg["type"].asString() == "int");
//    XCTAssertTrue(arg["value"].asString() == "int");
//    XCTAssertTrue(arg["encoding"].asString() == "i");
//    Json::Value returns = json["returns"];
//    XCTAssertTrue(returns["type"].asString() == "void");
//    XCTAssertTrue(returns["value"].asString() == "void");
//    XCTAssertTrue(returns["encoding"].asString() == "v");
//}
//
//- (void)testBlockWithArgAndReturnAsJSON {
//    hyperloop::ParserContext context("sdk", "9.0", false, "");
//    Json::Value json = hyperloop::callbackToJSON(&context, "int (^)(int)");
//    XCTAssertTrue(json);
//    XCTAssertTrue(json["signature"].asString() == "int (^)(int)");
//    XCTAssertTrue(json["type"].asString() == "block");
//    XCTAssertTrue(json["encoding"].asString() == "@?");
//    Json::Value args = json["arguments"];
//    XCTAssertEqual(args.size(), 1);
//    Json::Value arg = args[0];
//    XCTAssertTrue(arg["type"].asString() == "int");
//    XCTAssertTrue(arg["value"].asString() == "int");
//    XCTAssertTrue(arg["encoding"].asString() == "i");
//    Json::Value returns = json["returns"];
//    XCTAssertTrue(returns["type"].asString() == "int");
//    XCTAssertTrue(returns["value"].asString() == "int");
//    XCTAssertTrue(returns["encoding"].asString() == "i");
//}
//
//- (void)testBlockWithTypedefAsJSON {
//    hyperloop::ParserContext context("sdk", "9.0", false, "");
//    CXCursor cursor;
//    cursor.kind = CXCursor_TypedefDecl;
//    auto type = new hyperloop::TypeDefinition(cursor, "dispatch_block_t", &context);
//    hyperloop::Type atype(&context, "block", "void (^)(void)");
//    type->setType(&atype, "@?");
//    context.getParserTree()->addType(type);
//    Json::Value json = hyperloop::callbackToJSON(&context, "dispatch_block_t");
//    XCTAssertTrue(json);
//    XCTAssertTrue(json["signature"].asString() == "dispatch_block_t");
//    XCTAssertTrue(json["type"].asString() == "block");
//    XCTAssertTrue(json["encoding"].asString() == "@?");
//    Json::Value args = json["arguments"];
//    XCTAssertEqual(args.size(), 0);
//    Json::Value returns = json["returns"];
//    XCTAssertTrue(returns["type"].asString() == "void");
//    XCTAssertTrue(returns["value"].asString() == "void");
//    XCTAssertTrue(returns["encoding"].asString() == "v");
//}

@end

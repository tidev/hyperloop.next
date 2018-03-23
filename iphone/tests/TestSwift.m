/**
 * Hyperloop Library
 * Copyright (c) 2015 by Appcelerator, Inc.
 */

#import <XCTest/XCTest.h>
#import "utils.h"

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wundeclared-selector"

@interface TestSwift : XCTestCase

@end

@implementation TestSwift

- (void)testSwiftInvocation {
	Class cls = NSClassFromString(@"_TtC5Tests8TestView");
	XCTAssertNotNil(cls);

	id obj = [cls new];
	id result = [HyperloopUtils invokeSelector:@selector(foo:y:) args:@[@1,@2] target:obj instance:YES];
	XCTAssertEqualObjects(result, @3);
}

@end

#pragma clang diagnostic pop

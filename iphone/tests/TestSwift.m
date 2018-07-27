/**
 * Hyperloop iOS-Core
 * Copyright (c) 2015-present by Appcelerator, Inc.
 */

#import <XCTest/XCTest.h>
#import "utils.h"

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

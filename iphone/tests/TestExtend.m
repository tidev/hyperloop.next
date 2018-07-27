/**
 * Hyperloop iOS-Core
 * Copyright (c) 2015-present by Appcelerator, Inc.
 */

#import <XCTest/XCTest.h>
#import <objc/message.h>
#import "class.h"
#import "pointer.h"
#import "utils.h"

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wundeclared-selector"

@interface TestExtend : XCTestCase

@end

@interface MockKrollCallback : NSObject {
	NSArray *_parameters;
	id _target;
	BOOL _invoked;
}

-(id)target;
-(NSArray *)parameters;
-(BOOL)invoked;
-(void)reset;

@end

@implementation MockKrollCallback
-(void)call:(NSArray *)parameterList thisObject:(id)thisObject {
	_parameters = parameterList;
	_target = thisObject;
	_invoked = YES;
}
-(id)target {
	return _target;
}
-(NSArray *)parameters {
	return _parameters;
}
-(BOOL)invoked {
	return _invoked;
}
-(void)reset {
	_target = nil;
	_parameters = nil;
	_invoked = NO;
}
-(void)addCallback:(void (^)(void))callback {
	callback();
}
-(id)Block_void_____void_:(MockKrollCallback *) callback {
	return [^{
		[callback call:nil thisObject:nil];
	} copy];
}
-(void)dealloc {
	_parameters = nil;
	_target = nil;
}
@end

@interface TestObject : NSObject
@end

@implementation TestObject
@end

@implementation TestExtend

#ifdef HYPERLOOP_MEMORY_TRACKING
-(void)tearDown {
	HyperloopTrackDumpAll();
}
#endif

- (void)testBlock {
	MockKrollCallback *callback = [[MockKrollCallback alloc] init];
	__block bool called = NO;
	void(^Block)() = ^{
		called = YES;
	};
	[HyperloopUtils invokeSelector:@selector(addCallback:) args:@[Block] target:callback instance:YES];
	XCTAssertTrue(called);
}

- (void)testBlockWrapped {
	MockKrollCallback *callback = [[MockKrollCallback alloc] init];
	HyperloopPointer * p = [HyperloopUtils invokeSelector:@selector(Block_void_____void_:) args:@[callback] target:callback instance:YES];
	void(^Block)(void) = (void(^)(void))[p objectValue];
	Block();
	XCTAssertEqual(callback.invoked, YES);
}

@end

#pragma clang diagnostic pop

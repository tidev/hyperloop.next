/**
 * Hyperloop Library
 * Copyright (c) 2015-Present by Appcelerator, Inc.
 */

@import XCTest;

#import "HyperloopClass.h"
#import "HyperloopPointer.h"
#import "HyperloopUtils.h"

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wundeclared-selector"

@interface TestDispatch : XCTestCase

@end

@interface TestDispatchMock : NSObject
@end

@implementation TestDispatchMock
-(void)test:(int *)result {
	*result = 12;
}
-(int *)testWithIntPointerResult:(int)value {
	int *i = malloc(sizeof(int) * 2);
	i[0] = value + 1;
	i[1] = value + 2;
	return i;
}
-(int)testWithInt:(int)value {
	return value + 1;
}
-(float)testWithFloat:(float)value {
	return value + 1.1f;
}
-(long)testWithLong:(long)value {
	return value + 1;
}
-(short)testWithShort:(short)value {
	return value + 1;
}
-(double)testWithDouble:(double)value {
	return value + 1.02;
}
-(char)testWithChar:(char)value {
	return value;
}
-(unsigned char)testWithUnsignedChar:(unsigned char)value {
	return value;
}
-(char *)testWithCharStar:(char *)value {
	return "xyz";
}
-(bool)testWithBool:(bool)value {
	return !value;
}
-(long long)testWithLongLong:(long long)value {
	return value + 1;
}
-(unsigned int)testWithUnsignedInt:(unsigned int)value {
	return value + 1;
}
-(unsigned long)testWithUnsignedLong:(unsigned long)value {
	return value + 1;
}
-(unsigned short)testWithUnsignedShort:(unsigned short)value {
	return value + 1;
}
-(unsigned long long)testWithUnsignedLongLong:(unsigned long long)value {
	return value + 1;
}
-(CGRect)testWithCGRect:(CGRect)rect {
	rect.origin.x = 10;
	rect.origin.y = 10;
	return rect;
}
-(Class)testWithClass:(Class)cls {
	return cls;
}
-(SEL)testWithSEL:(SEL)value {
	return value;
}
-(id)testWithID: (id)value {
	return value;
}
@end

@implementation TestDispatch

#ifdef HYPERLOOP_MEMORY_TRACKING
-(void)tearDown {
	HyperloopTrackDumpAll();
}
#endif

- (void)testNoArgDispatch {
	HyperloopClass *cls = [[HyperloopClass alloc] initWithClassName:@"NSString" alloc:YES init:@selector(initWithString:) args:@[@"hello"]];
	id result = [HyperloopUtils invokeSelector:@selector(description) args:nil target:cls instance:YES];
	XCTAssertEqualObjects(result, @"hello");
}

- (void)testNoArgDispatchWithClassMethod {
	HyperloopClass *cls = [[HyperloopClass alloc] initWithClassName:@"NSString" alloc:YES init:@selector(initWithString:) args:@[@"hello"]];
	id result = [HyperloopUtils invokeSelector:@selector(class) args:nil target:cls instance:NO];
	XCTAssertEqualObjects([result stringValue], NSStringFromClass([@"hello" class]));
}

//// Variadic methods don't work with NSInvocation
//- (void)testWithArguments {
//	HyperloopClass *cls = [Hyperloop newClass:@"NSMutableString" alloc:YES init:@selector(initWithString:) args:@[@""]];
//	NSArray *args = @[
//		@"appendFormat:",
//		@[
//			@"hello %@",
//			@"world"
//		]
//	];
//	[cls dispatch:args];
//	id result = [cls dispatch:@[@"description"]];
//	XCTAssertEqualObjects(result, @"hello world");
//}

- (void)testWithArguments {
	HyperloopClass *cls = [[HyperloopClass alloc] initWithClassName:@"NSMutableString" alloc:YES init:@selector(initWithString:) args:@[@""]];
	id result = [HyperloopUtils invokeSelector:@selector(appendString:) args:@[@"hello world"] target:cls instance:YES];
	XCTAssertNil(result);
	result = [HyperloopUtils invokeSelector:@selector(description) args:nil target:cls instance:YES];
	XCTAssertEqualObjects(result, @"hello world");
}

- (void)testWithIntPointer {
	HyperloopClass *cls = [[HyperloopClass alloc] initWithClassName:@"TestDispatchMock" alloc:YES init:@selector(init) args:nil];
	HyperloopPointer *ptr = [HyperloopPointer encoding:@encode(int *)];
	id result = [HyperloopUtils invokeSelector:@selector(test:) args:@[ptr] target:cls instance:YES];
	XCTAssertNil(result);
	id value = [ptr valueAtIndex:0];
	XCTAssertEqual([value intValue], 12);
}

- (void)testWithIntPointerResult {
	HyperloopClass *cls = [[HyperloopClass alloc] initWithClassName:@"TestDispatchMock" alloc:YES init:@selector(init) args:nil];
	HyperloopPointer *ptr = [HyperloopPointer encoding:@encode(int)];
	HyperloopPointer *result = [HyperloopUtils invokeSelector:@selector(testWithIntPointerResult:) args:@[ptr] target:cls instance:YES];
	XCTAssertEqual([[result valueAtIndex:0] intValue], 1);
	XCTAssertEqual([[result valueAtIndex:1] intValue], 2);
}

- (void)testWithIntValue {
	HyperloopClass *cls = [[HyperloopClass alloc] initWithClassName:@"TestDispatchMock" alloc:YES init:@selector(init) args:nil];
	HyperloopPointer *ptr = [HyperloopPointer encoding:@encode(int)];
	[ptr setValue:@1 atIndex:0];
	HyperloopPointer *result = [HyperloopUtils invokeSelector:@selector(testWithInt:) args:@[ptr] target:cls instance:YES];
	XCTAssertNotNil(result);
	XCTAssertEqual([result intValue], 2);
}

- (void)testWithFloatValue {
	HyperloopClass *cls = [[HyperloopClass alloc] initWithClassName:@"TestDispatchMock" alloc:YES init:@selector(init) args:nil];
	HyperloopPointer *ptr = [HyperloopPointer encoding:@encode(float)];
	[ptr setValue:@1.0f atIndex:0];
	HyperloopPointer *result = [HyperloopUtils invokeSelector:@selector(testWithFloat:) args:@[ptr] target:cls instance:YES];
	XCTAssertNotNil(result);
	XCTAssertEqual([result floatValue], 2.1f);
}

- (void)testWithDoubleValue {
	HyperloopClass *cls = [[HyperloopClass alloc] initWithClassName:@"TestDispatchMock" alloc:YES init:@selector(init) args:nil];
	HyperloopPointer *ptr = [HyperloopPointer encoding:@encode(double)];
	[ptr setValue:@1.0f atIndex:0];
	HyperloopPointer *result = [HyperloopUtils invokeSelector:@selector(testWithDouble:) args:@[ptr] target:cls instance:YES];
	XCTAssertNotNil(result);
	XCTAssertEqual([result doubleValue], 2.0200000);
}

- (void)testWithShortValue {
	HyperloopClass *cls = [[HyperloopClass alloc] initWithClassName:@"TestDispatchMock" alloc:YES init:@selector(init) args:nil];
	HyperloopPointer *ptr = [HyperloopPointer encoding:@encode(short)];
	[ptr setValue:@1 atIndex:0];
	HyperloopPointer *result = [HyperloopUtils invokeSelector:@selector(testWithShort:) args:@[ptr] target:cls instance:YES];
	XCTAssertNotNil(result);
	XCTAssertEqual([result shortValue], 2);
}

- (void)testWithLongValue {
	HyperloopClass *cls = [[HyperloopClass alloc] initWithClassName:@"TestDispatchMock" alloc:YES init:@selector(init) args:nil];
	HyperloopPointer *ptr = [HyperloopPointer encoding:@encode(long)];
	[ptr setValue:@1 atIndex:0];
	HyperloopPointer *result = [HyperloopUtils invokeSelector:@selector(testWithLong:) args:@[ptr] target:cls instance:YES];
	XCTAssertNotNil(result);
	XCTAssertEqual([result longValue], 2);
}

- (void)testWithLongLongValue {
	HyperloopClass *cls = [[HyperloopClass alloc] initWithClassName:@"TestDispatchMock" alloc:YES init:@selector(init) args:nil];
	HyperloopPointer *ptr = [HyperloopPointer encoding:@encode(long long)];
	[ptr setValue:@1 atIndex:0];
	HyperloopPointer *result = [HyperloopUtils invokeSelector:@selector(testWithLongLong:) args:@[ptr] target:cls instance:YES];
	XCTAssertNotNil(result);
	XCTAssertEqual([result longLongValue], 2);
}

- (void)testWithUnsignedIntValue {
	HyperloopClass *cls = [[HyperloopClass alloc] initWithClassName:@"TestDispatchMock" alloc:YES init:@selector(init) args:nil];
	HyperloopPointer *ptr = [HyperloopPointer encoding:@encode(unsigned int)];
	[ptr setValue:@1 atIndex:0];
	HyperloopPointer *result = [HyperloopUtils invokeSelector:@selector(testWithUnsignedInt:) args:@[ptr] target:cls instance:YES];
	XCTAssertNotNil(result);
	XCTAssertEqual([result unsignedIntValue], 2);
}

- (void)testWithUnsignedShortValue {
	HyperloopClass *cls = [[HyperloopClass alloc] initWithClassName:@"TestDispatchMock" alloc:YES init:@selector(init) args:nil];
	HyperloopPointer *ptr = [HyperloopPointer encoding:@encode(unsigned short)];
	[ptr setValue:@1 atIndex:0];
	HyperloopPointer *result = [HyperloopUtils invokeSelector:@selector(testWithUnsignedShort:) args:@[ptr] target:cls instance:YES];
	XCTAssertNotNil(result);
	XCTAssertEqual([result unsignedShortValue], 2);
}

- (void)testWithUnsignedLongLongValue {
	HyperloopClass *cls = [[HyperloopClass alloc] initWithClassName:@"TestDispatchMock" alloc:YES init:@selector(init) args:nil];
	HyperloopPointer *ptr = [HyperloopPointer encoding:@encode(unsigned long long)];
	[ptr setValue:@1 atIndex:0];
	HyperloopPointer *result = [HyperloopUtils invokeSelector:@selector(testWithUnsignedLongLong:) args:@[ptr] target:cls instance:YES];
	XCTAssertNotNil(result);
	XCTAssertEqual([result unsignedLongLongValue], 2);
}

- (void)testWithBoolValue {
	HyperloopClass *cls = [[HyperloopClass alloc] initWithClassName:@"TestDispatchMock" alloc:YES init:@selector(init) args:nil];
	HyperloopPointer *ptr = [HyperloopPointer encoding:@encode(bool)];
	[ptr setValue:@1 atIndex:0];
	HyperloopPointer *result = [HyperloopUtils invokeSelector:@selector(testWithBool:) args:@[ptr] target:cls instance:YES];
	XCTAssertNotNil(result);
	XCTAssertEqual([result boolValue], false);
}

- (void)testWithCharValue {
	HyperloopClass *cls = [[HyperloopClass alloc] initWithClassName:@"TestDispatchMock" alloc:YES init:@selector(init) args:nil];
	HyperloopPointer *ptr = [HyperloopPointer encoding:@encode(char)];
	[ptr setValue:@'a' atIndex:0];
	HyperloopPointer *result = [HyperloopUtils invokeSelector:@selector(testWithChar:) args:@[ptr] target:cls instance:YES];
	XCTAssertNotNil(result);
	XCTAssertEqual([result charValue], 'a');
}

- (void)testWithUnsignedCharValue {
	HyperloopClass *cls = [[HyperloopClass alloc] initWithClassName:@"TestDispatchMock" alloc:YES init:@selector(init) args:nil];
	HyperloopPointer *ptr = [HyperloopPointer encoding:@encode(unsigned char)];
	[ptr setValue:@'a' atIndex:0];
	HyperloopPointer *result = [HyperloopUtils invokeSelector:@selector(testWithUnsignedChar:) args:@[ptr] target:cls instance:YES];
	XCTAssertNotNil(result);
	XCTAssertEqual([result unsignedCharValue], 'a');
}

- (void)testWithCharStarValue {
	HyperloopClass *cls = [[HyperloopClass alloc] initWithClassName:@"TestDispatchMock" alloc:YES init:@selector(init) args:nil];
	HyperloopPointer *ptr = [HyperloopPointer encoding:@encode(char *)];
	[ptr setValue:@"abc" atIndex:0];
	HyperloopPointer *result = [HyperloopUtils invokeSelector:@selector(testWithCharStar:) args:@[ptr] target:cls instance:YES];
	XCTAssertNotNil(result);
	XCTAssertEqualObjects([result stringValue], @"xyz");
}

- (void)testWithStruct {
	HyperloopClass *cls = [[HyperloopClass alloc] initWithClassName:@"TestDispatchMock" alloc:YES init:@selector(init) args:nil];
	HyperloopPointer *ptr = [HyperloopPointer encoding:@encode(CGRect)];
	HyperloopPointer *result = [HyperloopUtils invokeSelector:@selector(testWithCGRect:) args:@[ptr] target:cls instance:YES];
	XCTAssertNotNil(result);
	XCTAssertEqualObjects([result valueAtIndex:0], @10);
	XCTAssertEqualObjects([result valueAtIndex:1], @10);
}

- (void)testWithSelector {
	HyperloopClass *cls = [[HyperloopClass alloc] initWithClassName:@"TestDispatchMock" alloc:YES init:@selector(init) args:nil];
	SEL sel = @selector(foo:bar:);
	HyperloopPointer *ptr = [HyperloopPointer pointer:sel encoding:@encode(SEL)];
	HyperloopPointer *result = [HyperloopUtils invokeSelector:@selector(testWithSEL:) args:@[ptr] target:cls instance:YES];
	XCTAssertNotNil(result);
	XCTAssertEqualObjects([result selectorValue], NSStringFromSelector(sel));
}

- (void)testNewString {
	HyperloopClass *cls = [[HyperloopClass alloc] initWithClassName:@"NSString" alloc:NO init:@selector(stringWithString:) args:@[@"hello"]];
	XCTAssertNotNil(cls);
	HyperloopPointer *description = [HyperloopUtils invokeSelector:@selector(description) args:nil target:cls instance:YES];
	XCTAssertNotNil(description);
	XCTAssertEqualObjects(description, @"hello");
	HyperloopPointer *hash = [HyperloopUtils invokeSelector:@selector(hash) args:nil target:cls instance:YES];
	XCTAssertNotNil(hash);
	HyperloopPointer *uppercaseString = [HyperloopUtils invokeSelector:@selector(uppercaseString) args:nil target:cls instance:YES];
	XCTAssertNotNil(uppercaseString);
	XCTAssertEqualObjects(uppercaseString, @"HELLO");
	HyperloopPointer *append = [HyperloopUtils invokeSelector:@selector(stringByAppendingString:) args:@[@" world"] target:cls instance:YES];
	XCTAssertNotNil(append);
	XCTAssertEqualObjects(append, @"hello world");
}

- (void)testCFDictionaryRetain {
	@autoreleasepool {
		CFMutableDictionaryRef registeredProxies = CFDictionaryCreateMutable(NULL, 10, &kCFTypeDictionaryKeyCallBacks, &kCFTypeDictionaryValueCallBacks);
		HyperloopClass *proxy = [[HyperloopClass alloc] initWithClassName:@"UIView" alloc:NO init:@selector(class) args:nil];
		id result = (id)CFDictionaryGetValue(registeredProxies, (__bridge const void *)(proxy));
		XCTAssertNil(result);
		CFDictionaryAddValue(registeredProxies,(__bridge const void *)(proxy),(__bridge const void *)(proxy));
		result = (id)CFDictionaryGetValue(registeredProxies, (__bridge const void *)(proxy));
		XCTAssertNotNil(result);
		CFDictionaryRemoveAllValues(registeredProxies);
		CFRelease(registeredProxies);
		proxy = nil;
	}
}


@end

#pragma clang diagnostic pop

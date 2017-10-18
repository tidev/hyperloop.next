/**
 * Hyperloop Library
 * Copyright (c) 2015-Present by Appcelerator, Inc.
 */

@import XCTest;

#import "HyperloopPointer.h"
#import "HyperloopUtils.h"

@interface TestUtils : XCTestCase

@end

@interface TestMarshallObject : NSObject
@end

@implementation TestMarshallObject
- (bool)test:(CGRect)rect
{
  return (rect.origin.x == 10 && rect.origin.y == 20 && rect.size.width == 30 && rect.size.height == 40);
}
- (bool)testFloat:(float)f
{
  return f == 2.2f;
}
- (Class)testClass:(Class)c
{
  return c;
}
- (SEL)testSEL:(SEL)sel
{
  return sel;
}
- (char *)testCharStar:(char *)str
{
  return str;
}
@end

NSString *GenerateIdentifier(NSString *className, NSString *methodName, BOOL instance);

@implementation TestUtils

- (void)testUnmarshalArgument
{
  TestMarshallObject *object = [TestMarshallObject new];
  HyperloopPointer *p = [HyperloopPointer encoding:@encode(CGRect)];
  [p setValue:@10 atIndex:0];
  [p setValue:@20 atIndex:1];
  [p setValue:@30 atIndex:2];
  [p setValue:@40 atIndex:3];
  NSInvocation *invocation = [NSInvocation invocationWithMethodSignature:[object methodSignatureForSelector:@selector(test:)]];
  invocation.target = object;
  invocation.selector = @selector(test:);
  [invocation setArgument:&p atIndex:2];
  [HyperloopUtils unmarshalObject:invocation arg:p index:2];
  [invocation invoke];
  bool result;
  [invocation getReturnValue:&result];
  XCTAssertTrue(result);
}

- (void)testUnmarshalPrimitivesFromObject
{
  TestMarshallObject *object = [TestMarshallObject new];
  NSInvocation *invocation = [NSInvocation invocationWithMethodSignature:[object methodSignatureForSelector:@selector(testFloat:)]];
  invocation.target = object;
  invocation.selector = @selector(testFloat:);
  NSNumber *p = [NSNumber numberWithFloat:2.2f];
  [invocation setArgument:&p atIndex:2];
  [HyperloopUtils unmarshalObject:invocation arg:p index:2];
  [invocation invoke];
  bool result;
  [invocation getReturnValue:&result];
  XCTAssertTrue(result);
}

- (void)testUnmarshalClass
{
  TestMarshallObject *object = [TestMarshallObject new];
  NSInvocation *invocation = [NSInvocation invocationWithMethodSignature:[object methodSignatureForSelector:@selector(testClass:)]];
  invocation.target = object;
  invocation.selector = @selector(testClass:);
  NSString *p = @"UIView";
  [invocation setArgument:&p atIndex:2];
  [HyperloopUtils unmarshalObject:invocation arg:p index:2];
  [invocation invoke];
  Class result;
  [invocation getReturnValue:&result];
  XCTAssertTrue(result == [UIView class]);
}

- (void)testUnmarshalSEL
{
  TestMarshallObject *object = [TestMarshallObject new];
  NSInvocation *invocation = [NSInvocation invocationWithMethodSignature:[object methodSignatureForSelector:@selector(testSEL:)]];
  invocation.target = object;
  invocation.selector = @selector(testSEL:);
  NSString *p = @"testSEL:";
  [invocation setArgument:&p atIndex:2];
  [HyperloopUtils unmarshalObject:invocation arg:p index:2];
  [invocation invoke];
  SEL result;
  [invocation getReturnValue:&result];
  XCTAssertTrue(result == @selector(testSEL:));
}

- (void)testUnmarshalCharStar
{
  TestMarshallObject *object = [TestMarshallObject new];
  NSInvocation *invocation = [NSInvocation invocationWithMethodSignature:[object methodSignatureForSelector:@selector(testCharStar:)]];
  invocation.target = object;
  invocation.selector = @selector(testCharStar:);
  NSString *p = @"abc";
  [invocation setArgument:&p atIndex:2];
  [HyperloopUtils unmarshalObject:invocation arg:p index:2];
  [invocation invoke];
  char *result = NULL;
  [invocation getReturnValue:&result];
  XCTAssertTrue(strstr(result, "abc") == "abc");
}

- (void)testGenerateIdentifier
{
  NSString *cls = @"FooBar";
  XCTAssertEqualObjects(GenerateIdentifier(cls, @"foo", 0), @"FooBar_foo_0");
  XCTAssertEqualObjects(GenerateIdentifier(cls, @"foo", 1), @"FooBar_foo_1");
  XCTAssertEqualObjects(GenerateIdentifier(cls, @"foo:", 1), @"FooBar_foo__1");
  XCTAssertEqualObjects(GenerateIdentifier(cls, @"foo:bar:", 1), @"FooBar_foo_bar__1");
}

@end

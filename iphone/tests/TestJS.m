/**
 * Hyperloop Library
 * Copyright (c) 2015-Present by Appcelerator, Inc.
 */

#import <XCTest/XCTest.h>
#import <JavaScriptCore/JavaScriptCore.h>
#import "HyperloopModule.h"
#import "pointer.h"
#import "class.h"
#import "utils.h"

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wundeclared-selector"

static id KrollValue;
static JSClassRef classDef;

static NSString *NSStringFromJSValueRef (JSContextRef ctx, JSValueRef value, JSValueRef *exception) {
	JSStringRef string = JSValueToStringCopy(ctx, value, exception);
	size_t len = JSStringGetMaximumUTF8CStringSize(string);
	char *s = malloc(len);
	len = JSStringGetUTF8CString(string, s, len);
	NSString *str = [NSString stringWithUTF8String:s];
	free(s);
	JSStringRelease(string);
	return str;
}

@class KrollCallback;

id TiValueRefToId (JSContextRef ctx, const JSValueRef value, JSValueRef *exception);
void HyperloopRegisterCallbackForIdentifier (KrollCallback *callback, NSString *identifier);

JSObjectRef ConstructorCallback (JSContextRef ctx, JSObjectRef constructor, size_t argumentCount, const JSValueRef arguments[], JSValueRef* exception) {
	id obj = TiValueRefToId(ctx, arguments[0], exception);
	return JSObjectMake(ctx, classDef, (__bridge void *)(obj));
}

JSValueRef FunctionCallback (JSContextRef ctx, JSObjectRef function, JSObjectRef thisObject, size_t argumentCount, const JSValueRef arguments[], JSValueRef* exception) {
	id obj = TiValueRefToId(ctx, arguments[0], exception);
	return JSObjectMake(ctx, classDef, (__bridge void *)(obj));
}

JSValueRef KrollCallbackFunction (JSContextRef ctx, JSObjectRef function, JSObjectRef thisObject, size_t argumentCount, const JSValueRef arguments[], JSValueRef* exception) {
	return JSValueMakeNumber(ctx, 123);
}

@interface KrollContext : NSObject
@property (assign) JSGlobalContextRef context;
@end

@interface KrollBridge : NSObject
@end

@interface KrollCallback : NSObject

@property (retain) NSArray * args;
@property (retain) id thisObject;
@property (retain) id result;
@property (assign) BOOL called;
@property (assign) JSObjectRef function;

-(id)call:(NSArray *)args thisObject:(id)this;

@end

@implementation KrollContext
@end

@implementation KrollBridge
@end

@implementation KrollCallback
-(id)call:(NSArray *)args_ thisObject:(id)thisObject_ {
	_args = args_;
	_thisObject = thisObject_;
	_called = YES;
	return _result;
}
@end

@interface KrollObject : NSObject
+(id)toID:(KrollContext *)c value:(JSValueRef)ref;
@end

@implementation KrollObject
+(id)toID:(KrollContext *)c value:(JSValueRef)ref {
	return KrollValue;
}
@end

@interface TestJSExample : NSObject
@end

@implementation TestJSExample
+(int)testInt {
	return 2;
}
+(void)testDoubleArg:(NSTimeInterval)duration {
	if (duration != 12.3) {
		@throw [NSException exceptionWithName:@"InvalidArg" reason:@"time should have been 12.3" userInfo:nil];
	}
}
@end

@interface TestJS : XCTestCase

@property (nonatomic, retain) KrollContext *ctx;
@property (nonatomic, retain) KrollBridge *bridge;
@property (nonatomic, assign) JSObjectRef global;
@property (nonatomic, assign) JSContextGroupRef group;

@end

@implementation TestJS

-(void)setUp {
	_ctx = [KrollContext new];
	_bridge = [KrollBridge new];
	_group = JSContextGroupCreate();
	_ctx.context = JSGlobalContextCreateInGroup(_group, NULL);
	[Hyperloop willStartNewContext:_ctx bridge:_bridge];
	_global = JSContextGetGlobalObject(_ctx.context);
	[Hyperloop didStartNewContext:_ctx bridge:_bridge];
	
}

-(void)tearDown {
	[Hyperloop willStopNewContext:_ctx bridge:_bridge];
	JSGlobalContextRelease(_ctx.context);
	JSContextGroupRelease(_group);
	[Hyperloop didStopNewContext:_ctx bridge:_bridge];
	_ctx.context = nil;
	_global = nil;
	_group = nil;
	_ctx = nil;
	KrollValue = nil;
	_bridge = nil;
#ifdef HYPERLOOP_MEMORY_TRACKING
	HyperloopTrackDumpAll();
#endif
}

-(void)testCreateGlobal {
	JSStringRef prop = JSStringCreateWithUTF8CString("Hyperloop");
	XCTAssertTrue(JSObjectHasProperty(_ctx.context, _global, prop));
	JSValueRef exception = NULL;
	JSValueRef hyperloop = JSObjectGetProperty(_ctx.context, _global, prop, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertTrue(JSValueIsObject(_ctx.context, hyperloop));
	JSObjectRef hyperloopRef = JSValueToObject(_ctx.context, hyperloop, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(prop);
	prop = JSStringCreateWithUTF8CString("createProxy");
	XCTAssertTrue(JSObjectHasProperty(_ctx.context, hyperloopRef, prop));
	XCTAssertTrue(JSObjectIsFunction(_ctx.context, JSValueToObject(_ctx.context, JSObjectGetProperty(_ctx.context, hyperloopRef, prop, &exception), &exception)));
	XCTAssertTrue(exception == NULL);
	JSStringRelease(prop);
	prop = JSStringCreateWithUTF8CString("createPointer");
	XCTAssertTrue(JSObjectHasProperty(_ctx.context, hyperloopRef, prop));
	XCTAssertTrue(JSObjectIsFunction(_ctx.context, JSValueToObject(_ctx.context, JSObjectGetProperty(_ctx.context, hyperloopRef, prop, &exception), &exception)));
	XCTAssertTrue(exception == NULL);
	JSStringRelease(prop);
	prop = JSStringCreateWithUTF8CString("dispatch");
	XCTAssertTrue(JSObjectHasProperty(_ctx.context, hyperloopRef, prop));
	XCTAssertTrue(JSObjectIsFunction(_ctx.context, JSValueToObject(_ctx.context, JSObjectGetProperty(_ctx.context, hyperloopRef, prop, &exception), &exception)));
	XCTAssertTrue(exception == NULL);
	JSStringRelease(prop);
	prop = JSStringCreateWithUTF8CString("Hyperloop");
	JSObjectDeleteProperty(_ctx.context, _global, prop, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(prop);
}

-(void)testCreateClass {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("var p = Hyperloop.createProxy({class:'NSObject', alloc:false, init:'class', args:null}); Hyperloop.dispatch(p, 'description');");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(script);
	XCTAssertTrue(JSValueIsObject(_ctx.context, result));
	id p = (__bridge id)JSObjectGetPrivate(JSValueToObject(_ctx.context, result, &exception));
	XCTAssertTrue(exception == NULL);
	XCTAssertTrue([p isKindOfClass:[HyperloopPointer class]]);
	NSString *resultStr = NSStringFromJSValueRef(_ctx.context, result, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertTrue([resultStr isEqual:@"NSObject"]);
}

-(void)testCreateDictionary {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("var a = {'a':1}; a");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(script);
	XCTAssertTrue(JSValueIsObject(_ctx.context, result));
	id obj = TiValueRefToId(_ctx.context, result, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertNotNil(obj);
	XCTAssertTrue([obj isKindOfClass:[NSDictionary class]]);
	XCTAssertEqualObjects(obj, @{@"a":@1});
}

-(void)testCreateString {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("'foo'");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(script);
	XCTAssertTrue(JSValueIsString(_ctx.context, result));
	id obj = TiValueRefToId(_ctx.context, result, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertNotNil(obj);
	XCTAssertTrue([obj isKindOfClass:[NSString class]]);
	XCTAssertEqualObjects(obj, @"foo");
}

-(void)testCreateNumber {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("123");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(script);
	XCTAssertTrue(JSValueIsNumber(_ctx.context, result));
	id obj = TiValueRefToId(_ctx.context, result, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertNotNil(obj);
	XCTAssertTrue([obj isKindOfClass:[NSNumber class]]);
	XCTAssertEqualObjects(obj, @123);
}

-(void)testCreateBool {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("true");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(script);
	XCTAssertTrue(JSValueIsBoolean(_ctx.context, result));
	id obj = TiValueRefToId(_ctx.context, result, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertNotNil(obj);
	XCTAssertTrue([obj isKindOfClass:[NSNumber class]]);
	XCTAssertEqualObjects(obj, @YES);
}

-(void)testCreateUndefined {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("undefined");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(script);
	XCTAssertTrue(JSValueIsUndefined(_ctx.context, result));
	id obj = TiValueRefToId(_ctx.context, result, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertNotNil(obj);
	XCTAssertTrue([obj isKindOfClass:[NSNull class]]);
	XCTAssertEqualObjects(obj, [NSNull null]);
}

-(void)testCreateNull {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("null");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(script);
	XCTAssertTrue(JSValueIsNull(_ctx.context, result));
	id obj = TiValueRefToId(_ctx.context, result, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertNotNil(obj);
	XCTAssertTrue([obj isKindOfClass:[NSNull class]]);
	XCTAssertEqualObjects(obj, [NSNull null]);
}

-(void)testCreateDate {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("new Date()");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(script);
	XCTAssertTrue(JSValueIsDate(_ctx.context, result));
	id obj = TiValueRefToId(_ctx.context, result, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertNotNil(obj);
	XCTAssertTrue([obj isKindOfClass:[NSDate class]]);
	XCTAssertEqualObjects([obj description], [[NSDate date] description]);
}

-(void)testCreateArray {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("[1, 2, 3]");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(script);
	XCTAssertTrue(JSValueIsObject(_ctx.context, result));
	id obj = TiValueRefToId(_ctx.context, result, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertNotNil(obj);
	XCTAssertTrue([obj isKindOfClass:[NSArray class]]);
	id check = @[
		@1,
		@2,
		@3
	];
	XCTAssertEqualObjects(obj, check);
}

-(void)testCreateClassInDictionary {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("(function() {var p = Hyperloop.createProxy({class:'NSObject', alloc:false, init:'class', args:null}); return {'c':p}})()");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(script);
	XCTAssertTrue(JSValueIsObject(_ctx.context, result));
	id obj = TiValueRefToId(_ctx.context, result, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertNotNil(obj);
	XCTAssertTrue([obj isKindOfClass:[NSDictionary class]]);
	id p = [obj objectForKey:@"c"];
	XCTAssertNotNil(p);
	XCTAssertTrue([p isKindOfClass:[HyperloopClass class]]);
}

-(void)testCreateClassInArray {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("(function() {var p = Hyperloop.createProxy({class:'NSObject', alloc:false, init:'class', args:null}); return [p] })()");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(script);
	XCTAssertTrue(JSValueIsObject(_ctx.context, result));
	id obj = TiValueRefToId(_ctx.context, result, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertNotNil(obj);
	XCTAssertTrue([obj isKindOfClass:[NSArray class]]);
	id p = [obj objectAtIndex:0];
	XCTAssertNotNil(p);
	XCTAssertTrue([p isKindOfClass:[HyperloopClass class]]);
}


-(void)testCreatePointerInDictionary {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("(function() {var p = Hyperloop.createPointer('d'); return {'a':p} })()");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(script);
	XCTAssertTrue(JSValueIsObject(_ctx.context, result));
	id obj = TiValueRefToId(_ctx.context, result, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertNotNil(obj);
	XCTAssertTrue([obj isKindOfClass:[NSDictionary class]]);
	id p = [obj objectForKey:@"a"];
	XCTAssertNotNil(p);
	XCTAssertTrue([p isKindOfClass:[HyperloopPointer class]]);
	XCTAssertEqualObjects([p description], @"0.000000");
	XCTAssertEqual([p intValue], 0);
}

-(void)testCreatePointerInArray {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("(function() {var p = Hyperloop.createPointer('d'); return [p] })()");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(script);
	XCTAssertTrue(JSValueIsObject(_ctx.context, result));
	id obj = TiValueRefToId(_ctx.context, result, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertNotNil(obj);
	XCTAssertTrue([obj isKindOfClass:[NSArray class]]);
	id p = [obj objectAtIndex:0];
	XCTAssertNotNil(p);
	XCTAssertTrue([p isKindOfClass:[HyperloopPointer class]]);
	XCTAssertEqualObjects([p description], @"0.000000");
	XCTAssertEqual([p intValue], 0);
}

-(void)testCreatePointerConvertToString {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("(function() {var p = Hyperloop.createPointer('d'); return String(p) })()");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(script);
	XCTAssertTrue(JSValueIsString(_ctx.context, result));
	id obj = TiValueRefToId(_ctx.context, result, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertNotNil(obj);
	XCTAssertTrue([obj isKindOfClass:[NSString class]]);
	XCTAssertEqualObjects(obj, @"0.000000");
}

-(void)testIsNullPointer {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("(function() {var p = Hyperloop.createPointer('d'); return Hyperloop.isNull(p) })()");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(script);
	XCTAssertTrue(JSValueIsBoolean(_ctx.context, result));
	id obj = TiValueRefToId(_ctx.context, result, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertNotNil(obj);
	XCTAssertTrue([obj isKindOfClass:[NSNumber class]]);
	XCTAssertEqualObjects(obj, @NO);
}

-(void)testProtectUnprotect {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("(function() {var p = Hyperloop.createPointer('d'); return Hyperloop.protect(p) && Hyperloop.unprotect(p); })()");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(script);
	XCTAssertTrue(JSValueIsBoolean(_ctx.context, result));
	id obj = TiValueRefToId(_ctx.context, result, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertNotNil(obj);
	XCTAssertTrue([obj isKindOfClass:[NSNumber class]]);
	XCTAssertEqualObjects(obj, @YES);
}

-(void)testConvertToInt {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("(function() {var p = Hyperloop.createPointer('d'); return Hyperloop.intValue(p) })()");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(script);
	XCTAssertTrue(JSValueIsNumber(_ctx.context, result));
	id obj = TiValueRefToId(_ctx.context, result, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertNotNil(obj);
	XCTAssertTrue([obj isKindOfClass:[NSNumber class]]);
	XCTAssertEqualObjects(obj, @0);
}

-(void)testConvertToIntWithValue {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("(function() {var p = Hyperloop.createPointer('i'); Hyperloop.dispatch(p, 'setValue:atIndex:', [123, 0]); return Hyperloop.intValue(p) })()");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(script);
	XCTAssertTrue(JSValueIsNumber(_ctx.context, result));
	id obj = TiValueRefToId(_ctx.context, result, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertNotNil(obj);
	XCTAssertTrue([obj isKindOfClass:[NSNumber class]]);
	XCTAssertEqualObjects(obj, @123);
}

-(void)testConvertToIntAsString {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("(function() {var p = Hyperloop.createPointer('i'); Hyperloop.dispatch(p, 'setValue:atIndex:', [123, 0]); return Hyperloop.stringValue(p) })()");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(script);
	XCTAssertTrue(JSValueIsString(_ctx.context, result));
	id obj = TiValueRefToId(_ctx.context, result, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertNotNil(obj);
	XCTAssertTrue([obj isKindOfClass:[NSString class]]);
	XCTAssertEqualObjects(obj, @"123");
}

-(void)testJSStringAsString {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("Hyperloop.stringValue('hello')");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(script);
	XCTAssertTrue(JSValueIsString(_ctx.context, result));
	id obj = TiValueRefToId(_ctx.context, result, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertNotNil(obj);
	XCTAssertTrue([obj isKindOfClass:[NSString class]]);
	XCTAssertEqualObjects(obj, @"hello");
}

-(void)testJSBooleanTrueAsString {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("Hyperloop.stringValue(true)");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(script);
	XCTAssertTrue(JSValueIsString(_ctx.context, result));
	id obj = TiValueRefToId(_ctx.context, result, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertNotNil(obj);
	XCTAssertTrue([obj isKindOfClass:[NSString class]]);
	XCTAssertEqualObjects(obj, @"true");
}

-(void)testJSBooleanFalseAsString {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("Hyperloop.stringValue(false)");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(script);
	XCTAssertTrue(JSValueIsString(_ctx.context, result));
	id obj = TiValueRefToId(_ctx.context, result, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertNotNil(obj);
	XCTAssertTrue([obj isKindOfClass:[NSString class]]);
	XCTAssertEqualObjects(obj, @"false");
}

-(void)testJSNumberAsString {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("Hyperloop.stringValue(123)");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(script);
	XCTAssertTrue(JSValueIsString(_ctx.context, result));
	id obj = TiValueRefToId(_ctx.context, result, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertNotNil(obj);
	XCTAssertTrue([obj isKindOfClass:[NSString class]]);
	XCTAssertEqualObjects(obj, @"123");
}

-(void)testJSBooleanTrueAsBool {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("Hyperloop.boolValue(true)");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(script);
	XCTAssertTrue(JSValueIsBoolean(_ctx.context, result));
	id obj = TiValueRefToId(_ctx.context, result, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertNotNil(obj);
	XCTAssertTrue([obj isKindOfClass:[NSNumber class]]);
	XCTAssertEqualObjects(obj, @YES);
}

-(void)testJSBooleanFalseAsBool {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("Hyperloop.boolValue(false)");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(script);
	XCTAssertTrue(JSValueIsBoolean(_ctx.context, result));
	id obj = TiValueRefToId(_ctx.context, result, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertNotNil(obj);
	XCTAssertTrue([obj isKindOfClass:[NSNumber class]]);
	XCTAssertEqualObjects(obj, @NO);
}

-(void)testJSFunctionAsString {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("function F() {}; F");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(script);
	XCTAssertTrue(JSValueIsObject(_ctx.context, result));
	KrollValue = [KrollCallback new];
	id obj = TiValueRefToId(_ctx.context, result, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertNotNil(obj);
	XCTAssertTrue([obj isKindOfClass:[KrollCallback class]]);
}

-(void)testJSRegExAsNSRegularExpression {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("/a/i");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRelease(script);
	XCTAssertTrue(JSValueIsObject(_ctx.context, result));
	id obj = TiValueRefToId(_ctx.context, result, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertNotNil(obj);
	XCTAssertTrue([obj isKindOfClass:[NSRegularExpression class]]);
	NSRegularExpression *re = (NSRegularExpression *)obj;
	XCTAssertTrue(([re options] & NSRegularExpressionCaseInsensitive) == NSRegularExpressionCaseInsensitive);
	XCTAssertTrue(([re options] & NSRegularExpressionAnchorsMatchLines) != NSRegularExpressionAnchorsMatchLines);
}

-(void)testException {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("Hyperloop.dispatch()");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception != NULL);
	XCTAssertTrue(result == NULL);
	XCTAssertTrue(JSValueIsObject(_ctx.context, exception));
	id obj = TiValueRefToId(_ctx.context, exception, NULL);
	XCTAssertNotNil(obj);
	XCTAssertTrue([obj isKindOfClass:[NSDictionary class]]);
	XCTAssertEqualObjects([obj objectForKey:@"column"], @19);
	XCTAssertEqualObjects([obj objectForKey:@"line"], @1);
	XCTAssertEqualObjects([obj objectForKey:@"name"], @"InvalidArgument");
	XCTAssertEqualObjects([obj objectForKey:@"description"], @"you must pass at least 2 arguments to dispatch");
	XCTAssertTrue([obj objectForKey:@"nativeStack"] != nil);
	JSStringRelease(script);
}

-(void)testStruct {
	CGRect rect = CGRectMake(10, 20, 30, 40);
	HyperloopPointer *pointer = [HyperloopPointer pointer:&rect encoding:@encode(CGRect)];
	JSObjectRef object = [Hyperloop createPointer:pointer];
	JSStringRef prop = JSStringCreateWithUTF8CString("CGRect");
	JSValueRef exception = NULL;
	JSObjectSetProperty(_ctx.context, _global, prop, object, 0, &exception);
	XCTAssertTrue(exception == NULL);
	JSStringRef script = JSStringCreateWithUTF8CString("(function() { return {x: Hyperloop.dispatch(CGRect, 'valueAtIndex:', 0), y:Hyperloop.dispatch(CGRect, 'valueAtIndex:', 1), width:Hyperloop.dispatch(CGRect, 'valueAtIndex:', 2), height:Hyperloop.dispatch(CGRect, 'valueAtIndex:', 3) }; })()");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertTrue(JSValueIsObject(_ctx.context, result));
	NSDictionary *dict = TiValueRefToId(_ctx.context, result, &exception);
	XCTAssertTrue(exception == NULL);
	NSDictionary *expected = @{ @"x": @10, @"y": @20, @"width": @30, @"height": @40 };
	XCTAssertEqualObjects(dict, expected);
}

-(void)testPrimitiveReturnTypes {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("(function() { var cls = Hyperloop.createProxy({class:'TestJSExample', alloc:false, init:'class' }); return Hyperloop.dispatch(cls, 'testInt'); })()");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertTrue(JSValueIsNumber(_ctx.context, result));
	XCTAssertEqual(2, JSValueToNumber(_ctx.context, result, &exception));
}

-(void)testPrimitiveArg {
	JSValueRef exception = NULL;
	JSStringRef script = JSStringCreateWithUTF8CString("(function() { var cls = Hyperloop.createProxy({class:'TestJSExample', alloc:false, init:'class' }); return Hyperloop.dispatch(cls, 'testDoubleArg:', 12.3); })()");
	JSValueRef result = JSEvaluateScript(_ctx.context, script, NULL, NULL, 0, &exception);
	XCTAssertTrue(exception == NULL);
	XCTAssertTrue(JSValueIsNull(_ctx.context, result));
}

- (void)testKrollCallbackWithIdentifier {
	KrollCallback *callback = [[KrollCallback alloc] init];
	HyperloopRegisterCallbackForIdentifier(callback, @"123");
	JSStringRef name = JSStringCreateWithUTF8CString("callbackFunction");
	callback.function = JSObjectMakeFunctionWithCallback(_ctx.context, name, KrollCallbackFunction);
	JSStringRelease(name);
	id result = [HyperloopUtils invokeCustomCallback:@[] identifier:@"123" thisObject:nil];
	XCTAssertNotNil(result);
}

@end

#pragma clang diagnostic pop

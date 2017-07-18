/**
 * Hyperloop Library
 * Copyright (c) 2015-Present by Appcelerator, Inc.
 */

#import <XCTest/XCTest.h>
#import "pointer.h"
#import "class.h"
#import "utils.h"

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wundeclared-selector"

static int testObjectDealloc = 0;

@interface TestCleanupObject : NSObject
@end

@implementation TestCleanupObject
-(void)dealloc {
	testObjectDealloc++;
}
@end

@interface TestPointers : XCTestCase

@end

@implementation TestPointers


-(void)testPointerNSString {
	@autoreleasepool {
		NSString *str = @"hello";
		HyperloopPointer *p = [HyperloopPointer pointer:(__bridge void *)str encoding:@encode(NSString *)];
		XCTAssertEqualObjects(str, [p stringValue]);
		XCTAssertEqualObjects(p, str);
	}
}

- (void)testPointerCharStar {
	@autoreleasepool {
		char *str = "abc";
		HyperloopPointer *p = [HyperloopPointer pointer:str encoding:@encode(char *)];
		id value = [p stringValue];
		XCTAssertEqualObjects(value, [NSString stringWithUTF8String:str]);
		NSUInteger len = [p length];
		XCTAssertEqual(len, strlen(str));
		value = [p valueAtIndex:0];
		XCTAssertEqualObjects(value, [NSNumber numberWithChar:'a']);
		len = [value length];
		XCTAssertEqual(len, 1);
		XCTAssertEqualObjects([value stringValue], @"a");
	}
}

- (void)testPointerCharStarStar {
	@autoreleasepool {
		char *str = "abc";
		HyperloopPointer *p = [HyperloopPointer pointer:&str encoding:@encode(char **)];
		id value = [p stringValue];
		XCTAssertTrue([value hasPrefix:@"[Pointer 0x"]);
		XCTAssertTrue([value hasSuffix:@"^*]"]);
		id result = [p valueAtIndex:0];
		XCTAssertTrue([result isKindOfClass:[HyperloopPointer class]]);
		XCTAssertEqualObjects(result, [NSString stringWithUTF8String:str]);
		NSUInteger len = [result length];
		XCTAssertEqual(len, strlen(str));
		XCTAssertEqualObjects([result description], @"abc");
	}
}

- (void)testPointerInt {
	@autoreleasepool {
		int i = 123;
		HyperloopPointer *p = [HyperloopPointer pointer:&i encoding:@encode(int)];
		int value = [p intValue];
		XCTAssertEqual(value, i);
	}
}

- (void)testPointerIntStar {
	@autoreleasepool {
		int i = 123;
		int *ip = &i;
		HyperloopPointer *p = [HyperloopPointer pointer:ip encoding:@encode(int *)];
		id result = [p valueAtIndex:0];
		XCTAssertTrue([result isKindOfClass:[HyperloopPointer class]]);
		XCTAssertEqualObjects([result description], @"123");
		XCTAssertEqual([result intValue], i);
	}
}

- (void)testPointerSEL {
	@autoreleasepool {
		SEL sel = @selector(testPointerSEL);
		HyperloopPointer *p = [HyperloopPointer pointer:sel encoding:@encode(SEL)];
		id value = [p selectorValue];
		XCTAssertTrue([value isKindOfClass:[NSString class]]);
		XCTAssertEqualObjects(value, NSStringFromSelector(sel));
		XCTAssertEqualObjects([value description], NSStringFromSelector(sel));
		XCTAssertEqualObjects([p stringValue], NSStringFromSelector(sel));
	}
}

- (void)testPointerSELStar {
	@autoreleasepool {
		SEL sel = @selector(testPointerSEL);
		SEL *sp = &sel;
		HyperloopPointer *p = [HyperloopPointer pointer:sp encoding:@encode(SEL *)];
		id value = [p valueAtIndex:0];
		XCTAssertTrue([value isKindOfClass:[HyperloopPointer class]]);
		value = (HyperloopPointer*)value;
		id result = [value selectorValue];
		XCTAssertTrue([result isKindOfClass:[NSString class]]);
		XCTAssertEqualObjects(result, NSStringFromSelector(sel));
	}
}

- (void)testPointerID {
	@autoreleasepool {
		NSObject *o = [[NSObject alloc] init];
		HyperloopPointer *p = [HyperloopPointer pointer:(__bridge void *)(o) encoding:@encode(NSObject *)];
		id value = [p objectValue];
		XCTAssertTrue([value isKindOfClass:[NSObject class]]);
		XCTAssertEqualObjects(value, o);
		XCTAssertEqualObjects(p, o);
		XCTAssertEqualObjects([value description], [o description]);
		XCTAssertEqualObjects([p description], [o description]);
	}
}

- (void)testStruct {
	@autoreleasepool {
		CGRect rect = CGRectMake(10, 20, 30, 40);
		HyperloopPointer *p = [HyperloopPointer pointer:&rect encoding:@encode(CGRect)];
		id value = [p valueAtIndex:0];
		XCTAssertEqualObjects(value, @10);
		XCTAssertEqual([value intValue], 10);
		value = [p valueAtIndex:1];
		XCTAssertEqualObjects(value, @20);
		XCTAssertEqual([value intValue], 20);
		value = [p valueAtIndex:2];
		XCTAssertEqualObjects(value, @30);
		XCTAssertEqual([value intValue], 30);
		value = [p valueAtIndex:3];
		XCTAssertEqualObjects(value, @40);
		XCTAssertEqual([value intValue], 40);
		CGRect rp = *(CGRect *)[p pointerValue];
		XCTAssertTrue(CGRectEqualToRect(rp, rect));
	}
}

- (void)testIntArray {
	@autoreleasepool {
		int i [] = {1, 2, 3};
		HyperloopPointer *p = [HyperloopPointer pointer:i encoding:"[3i]"];
		id value = [p valueAtIndex:0];
		XCTAssertEqual([value intValue], 1);
		value = [p valueAtIndex:1];
		XCTAssertEqual([value intValue], 2);
		value = [p valueAtIndex:2];
		XCTAssertEqual([value intValue], 3);
	}
}

- (void)testCharArray {
	@autoreleasepool {
		char i [] = {'a', 'b', 'c'};
		HyperloopPointer *p = [HyperloopPointer pointer:i encoding:"[3c]"];
		id value = [p valueAtIndex:0];
		XCTAssertEqual([value charValue], 'a');
		value = [p valueAtIndex:1];
		XCTAssertEqual([value charValue], 'b');
		value = [p valueAtIndex:2];
		XCTAssertEqual([value charValue], 'c');
	}
}

- (void)testCharStarAsChar {
	@autoreleasepool {
		char *s = "abc";
		HyperloopPointer *p = [HyperloopPointer pointer:s encoding:"*"];
		id value = [p valueAtIndex:0];
		XCTAssertEqual([value charValue], 'a');
		value = [p valueAtIndex:1];
		XCTAssertEqual([value charValue], 'b');
		value = [p valueAtIndex:2];
		XCTAssertEqual([value charValue], 'c');
		char buf[4];
		[p getValue:0 pointer:&buf];
		XCTAssertTrue(buf[0] == 'a');
	}
}

- (void)testBoolArray {
	@autoreleasepool {
		bool i [] = {true, false, true};
		HyperloopPointer *p = [HyperloopPointer pointer:i encoding:"[3B]"];
		id value = [p valueAtIndex:0];
		XCTAssertEqual([value boolValue], true);
		value = [p valueAtIndex:1];
		XCTAssertEqual([value boolValue], false);
		value = [p valueAtIndex:2];
		XCTAssertEqual([value boolValue], true);
	}
}

- (void)testFloatArray {
	@autoreleasepool {
		float f [] = {1.0f, 1.1f, 1.2f};
		HyperloopPointer *p = [HyperloopPointer pointer:f encoding:"[3f]"];
		id value = [p valueAtIndex:0];
		XCTAssertEqual([value floatValue], 1.0f);
		value = [p valueAtIndex:1];
		XCTAssertEqual([value floatValue], 1.1f);
		value = [p valueAtIndex:2];
		XCTAssertEqual([value floatValue], 1.2f);
	}
}

- (void)testStringEquality {
	@autoreleasepool {
		NSString *hello = @"hello world";
		HyperloopPointer *p = [HyperloopPointer pointer:(__bridge const void *)(hello) encoding:@encode(NSString *)];
		XCTAssertEqualObjects(@"HELLO WORLD", [(NSString *)p uppercaseString]);
		XCTAssertEqualObjects(p, hello);
	}
}

- (void)testSetStructMember {
	@autoreleasepool {
		CGRect rect = CGRectMake(10,20,30,40);
		HyperloopPointer *p = [HyperloopPointer pointer:&rect encoding:@encode(CGRect)];
		XCTAssertEqualObjects([p valueAtIndex:0], @10);
		XCTAssertEqualObjects([p valueAtIndex:1], @20);
		XCTAssertEqualObjects([p valueAtIndex:2], @30);
		XCTAssertEqualObjects([p valueAtIndex:3], @40);
		[p setValue:@100 atIndex:0];
		[p setValue:@200 atIndex:1];
		[p setValue:@300 atIndex:2];
		[p setValue:@400 atIndex:3];
		XCTAssertEqualObjects([p valueAtIndex:0], @100);
		XCTAssertEqualObjects([p valueAtIndex:1], @200);
		XCTAssertEqualObjects([p valueAtIndex:2], @300);
		XCTAssertEqualObjects([p valueAtIndex:3], @400);
	}
}

- (void)testInt {
	@autoreleasepool {
		int i = 12234;
		HyperloopPointer *p = [HyperloopPointer pointer:&i encoding:@encode(int)];
		XCTAssertEqual([p intValue], i);
		XCTAssertEqualObjects([p stringValue], @"12234");
	}
}

- (void)testFloat {
	@autoreleasepool {
		float f = 1.2234;
		HyperloopPointer *p = [HyperloopPointer pointer:&f encoding:@encode(float)];
		XCTAssertEqual([p floatValue], f);
		XCTAssertEqualObjects([p stringValue], @"1.223400");
	}
}

- (void)testLong {
	@autoreleasepool {
		long l = 12234;
		HyperloopPointer *p = [HyperloopPointer pointer:&l encoding:@encode(long)];
		XCTAssertEqual([p longValue], l);
		XCTAssertEqualObjects([p stringValue], @"12234");
	}
}

- (void)testLongLong {
	@autoreleasepool {
		long long l = 122341234123234L;
		HyperloopPointer *p = [HyperloopPointer pointer:&l encoding:@encode(long long)];
		XCTAssertEqual([p longLongValue], l);
		XCTAssertEqualObjects([p stringValue], @"122341234123234");
	}
}

- (void)testUnsignedLong {
	@autoreleasepool {
		unsigned long l = (unsigned long)1L;
		HyperloopPointer *p = [HyperloopPointer pointer:&l encoding:@encode(unsigned long)];
		XCTAssertEqual([p unsignedLongValue], l);
		XCTAssertEqualObjects([p stringValue], @"1");
	}
}

- (void)testUnsignedLongLong {
	@autoreleasepool {
		unsigned long long l = 12234121234L;
		HyperloopPointer *p = [HyperloopPointer pointer:&l encoding:@encode(unsigned long long)];
		XCTAssertEqual([p unsignedLongLongValue], l);
		XCTAssertEqualObjects([p stringValue], @"12234121234");
	}
}

- (void)testDouble {
	@autoreleasepool {
		double d = 12234123412341234;
		HyperloopPointer *p = [HyperloopPointer pointer:&d encoding:@encode(double)];
		XCTAssertEqual([p doubleValue], d);
		XCTAssertEqualObjects([p stringValue], @"12234123412341234.000000");
	}
}

- (void)testShort {
	short s = 1;
	HyperloopPointer *p = [HyperloopPointer pointer:&s encoding:@encode(short)];
	XCTAssertEqual([p shortValue], s);
	XCTAssertEqualObjects([p stringValue], @"1");
}

- (void)testBool {
	@autoreleasepool {
		bool b = true;
		HyperloopPointer *p = [HyperloopPointer pointer:&b encoding:@encode(bool)];
		XCTAssertEqual([p boolValue], b);
		XCTAssertEqualObjects([p stringValue], @"true");
		XCTAssertEqual([p intValue], 1);
		[p setValue:@false atIndex:0];
		XCTAssertEqual([p boolValue], false);
		XCTAssertEqualObjects([p stringValue], @"false");
		XCTAssertEqual([p intValue], 0);
	}
}

- (void)testChar {
	@autoreleasepool {
		char a = 'a';
		HyperloopPointer *p = [HyperloopPointer pointer:&a encoding:@encode(char)];
		XCTAssertEqual([p charValue], a);
		XCTAssertEqualObjects([p stringValue], @"a");
		[p setValue:@'z' atIndex:0];
		XCTAssertEqual([p charValue], 'z');
		XCTAssertEqualObjects([p stringValue], @"z");
	}
}

- (void)testUnsignedChar {
	@autoreleasepool {
		unsigned char a = 'a';
		HyperloopPointer *p = [HyperloopPointer pointer:&a encoding:@encode(unsigned char)];
		XCTAssertEqual([p charValue], a);
		XCTAssertEqual([p unsignedCharValue], a);
		XCTAssertEqualObjects([p stringValue], @"a");
		[p setValue:@'z' atIndex:0];
		XCTAssertEqual([p charValue], 'z');
		XCTAssertEqual([p unsignedCharValue], 'z');
		XCTAssertEqualObjects([p stringValue], @"z");
	}
}

- (void)testID {
	@autoreleasepool {
		id v = @"hello";
		HyperloopPointer *p = [HyperloopPointer pointer:(__bridge const void *)(v) encoding:@encode(id)];
		XCTAssertEqualObjects([p objectValue], v);
		XCTAssertEqualObjects([p stringValue], v);
		XCTAssertEqualObjects(p, v);
	}
}

- (void)testClass {
	@autoreleasepool {
		Class v = [NSString class];
		HyperloopPointer *p = [HyperloopPointer pointer:(__bridge const void *)(v) encoding:@encode(Class)];
		XCTAssertEqual(object_getClassName([p classValue]), object_getClassName(v));
		XCTAssertEqualObjects([p stringValue], [NSString stringWithUTF8String:object_getClassName(v)]);
	}
}

- (void)testFloatStar {
	@autoreleasepool {
		float *f = malloc(sizeof(float)*2);
		HyperloopPointer *p = [HyperloopPointer create:f encoding:@encode(float *)];
		[p setValue:@1.2 atIndex:0];
		id result = [p valueAtIndex:0];
		XCTAssertEqual([result floatValue], 1.2f);
	}
}

- (void)testMixedSizeStruct {
	@autoreleasepool {
		void *s = malloc(sizeof(float) + sizeof(int) + sizeof(double) + sizeof(bool) + sizeof(char) + sizeof(SEL) + sizeof(id) + sizeof(Class));
		HyperloopPointer *p = [HyperloopPointer pointer:s encoding:"{fidBc:@#}"];
		free(s);
		[p setValue:@1.2 atIndex:0];
		[p setValue:@2 atIndex:1];
		[p setValue:@0.1112 atIndex:2];
		[p setValue:@true atIndex:3];
		[p setValue:@'a' atIndex:4];
		[p setValue:@"foo:" atIndex:5];
		[p setValue:@"hello" atIndex:6];
		[p setValue:[NSString class] atIndex:7];
		XCTAssertEqual([[p valueAtIndex:0] floatValue], 1.2f);
		XCTAssertEqual([[p valueAtIndex:1] intValue], 2);
		XCTAssertEqual([[p valueAtIndex:2] doubleValue], 0.1112);
		XCTAssertEqual([[p valueAtIndex:3] boolValue], true);
		XCTAssertEqual([[p valueAtIndex:4] charValue], 'a');
		XCTAssertEqualObjects([[p valueAtIndex:5] selectorValue], NSStringFromSelector(@selector(foo:)));
		XCTAssertEqualObjects([[p valueAtIndex:6] objectValue], @"hello");
		XCTAssertEqual([[p valueAtIndex:7] classValue], [NSString class]);

		float f;
		[p getValue:0 pointer:&f];
		XCTAssertEqual(f, 1.2f);

		int i;
		[p getValue:1 pointer:&i];
		XCTAssertEqual(i, 2);

		double d;
		[p getValue:2 pointer:&d];
		XCTAssertEqual(d, 0.1112);

		bool b;
		[p getValue:3 pointer:&b];
		XCTAssertEqual(b, true);

		char c;
		[p getValue:4 pointer:&c];
		XCTAssertEqual(c, 'a');

		SEL sel;
		[p getValue:5 pointer:&sel];
		XCTAssertEqual(sel, @selector(foo:));

		id obj;
		[p getValue:6 pointer:&obj];
		XCTAssertEqualObjects(obj, @"hello");

		Class cls;
		[p getValue:7 pointer:&cls];
		XCTAssertEqualObjects([NSString stringWithUTF8String:object_getClassName(cls)], NSStringFromClass(cls));
	}
}

- (void)testStructPointer {
	@autoreleasepool {

		HyperloopPointer *p = [HyperloopPointer encoding:"{^f}"];
		HyperloopPointer *st = [HyperloopPointer encoding:"{f}"];

		XCTAssertEqual([st floatValue], 0.0f);

		[st setValue:@1.2 atIndex:0];
		[p setValue:st atIndex:0];

		HyperloopPointer *ptr = nil;
		[p getValue:0 pointer:&ptr];

		XCTAssertEqual([[ptr valueAtIndex:0] floatValue], 1.2f);
	}
}

- (void)testEncodings {
	@autoreleasepool {
		XCTAssertEqualObjects([HyperloopPointer stringEncoding], [NSString stringWithUTF8String:@encode(char *)]);
		XCTAssertEqualObjects([HyperloopPointer charEncoding], [NSString stringWithUTF8String:@encode(char)]);
		XCTAssertEqualObjects([HyperloopPointer intEncoding], [NSString stringWithUTF8String:@encode(int)]);
		XCTAssertEqualObjects([HyperloopPointer doubleEncoding], [NSString stringWithUTF8String:@encode(double)]);
		XCTAssertEqualObjects([HyperloopPointer longEncoding], [NSString stringWithUTF8String:@encode(long)]);
		XCTAssertEqualObjects([HyperloopPointer longLongEncoding], [NSString stringWithUTF8String:@encode(long long)]);
		XCTAssertEqualObjects([HyperloopPointer shortEncoding], [NSString stringWithUTF8String:@encode(short)]);
		XCTAssertEqualObjects([HyperloopPointer boolEncoding], [NSString stringWithUTF8String:@encode(bool)]);
		XCTAssertEqualObjects([HyperloopPointer floatEncoding], [NSString stringWithUTF8String:@encode(float)]);
		XCTAssertEqualObjects([HyperloopPointer pointerEncoding], [NSString stringWithUTF8String:@encode(void *)]);
		XCTAssertEqualObjects([HyperloopPointer objectEncoding], [NSString stringWithUTF8String:@encode(id)]);
		XCTAssertEqualObjects([HyperloopPointer classEncoding], [NSString stringWithUTF8String:@encode(Class)]);
		XCTAssertEqualObjects([HyperloopPointer selectorEncoding], [NSString stringWithUTF8String:@encode(SEL)]);
		XCTAssertEqualObjects([HyperloopPointer unsignedIntEncoding], [NSString stringWithUTF8String:@encode(unsigned int)]);
		XCTAssertEqualObjects([HyperloopPointer unsignedLongEncoding], [NSString stringWithUTF8String:@encode(unsigned long)]);
		XCTAssertEqualObjects([HyperloopPointer unsignedLongLongEncoding], [NSString stringWithUTF8String:@encode(unsigned long long)]);
		XCTAssertEqualObjects([HyperloopPointer unsignedCharEncoding], [NSString stringWithUTF8String:@encode(unsigned char)]);
		XCTAssertEqualObjects([HyperloopPointer floatPointerEncoding], [NSString stringWithUTF8String:@encode(float *)]);
		XCTAssertEqualObjects([HyperloopPointer longPointerEncoding], [NSString stringWithUTF8String:@encode(long *)]);
		XCTAssertEqualObjects([HyperloopPointer intPointerEncoding], [NSString stringWithUTF8String:@encode(int *)]);
		XCTAssertEqualObjects([HyperloopPointer doublePointerEncoding], [NSString stringWithUTF8String:@encode(double *)]);
		XCTAssertEqualObjects([HyperloopPointer shortPointerEncoding], [NSString stringWithUTF8String:@encode(short *)]);
		XCTAssertEqualObjects([HyperloopPointer boolPointerEncoding], [NSString stringWithUTF8String:@encode(bool *)]);
	}
}

- (void)testDispatch {
	@autoreleasepool {
		HyperloopPointer *st = [HyperloopPointer encoding:"{f}"];
		[st setValue:@2 atIndex:0];
		HyperloopPointer *result = [HyperloopUtils invokeSelector:@selector(valueAtIndex:) args:@[@0] target:st instance:YES];
		XCTAssertNotNil(result);
		XCTAssertEqual([result floatValue], 2.0f);
	}
}

- (void)testSetNestedStruct {
	@autoreleasepool {
		HyperloopPointer *st = [HyperloopPointer encoding:@encode(CGRect)];
		HyperloopPointer *sp = [HyperloopPointer encoding:@encode(CGPoint)];
		HyperloopPointer *ss = [HyperloopPointer encoding:@encode(CGSize)];
		[sp setValue:@10 atIndex:0];
		[sp setValue:@20 atIndex:1];
		[ss setValue:@100 atIndex:0];
		[ss setValue:@200 atIndex:1];
		[st setValue:[sp valueAtIndex:0] atIndex:0];
		[st setValue:[sp valueAtIndex:1] atIndex:1];
		[st setValue:[ss valueAtIndex:0] atIndex:2];
		[st setValue:[ss valueAtIndex:1] atIndex:3];
		XCTAssertEqual([[st valueAtIndex:0] doubleValue], 10);

		XCTAssertEqual([[st valueAtIndex:1] doubleValue], 20);
		XCTAssertEqual([[st valueAtIndex:2] doubleValue], 100);
		XCTAssertEqual([[st valueAtIndex:3] doubleValue], 200);
		XCTAssertEqual([[sp valueAtIndex:0] doubleValue], 10);
		XCTAssertEqual([[sp valueAtIndex:1] doubleValue], 20);
		XCTAssertEqual([[ss valueAtIndex:0] doubleValue], 100);
		XCTAssertEqual([[ss valueAtIndex:1] doubleValue], 200);
		[ss setValue:@1000 atIndex:0];
		XCTAssertEqual([[ss valueAtIndex:0] doubleValue], 1000);
		XCTAssertEqual([[st valueAtIndex:3] doubleValue], 200);

		UIView *view = [[UIView alloc] init];
		view.frame = *(CGRect *)[st pointerValue];

		XCTAssertEqual(view.frame.size.width, 100);
	}
}

- (void)testCFStringRef {
	@autoreleasepool {
		CFStringRef result = kCGPDFContextUserPassword;
		HyperloopPointer *p = [HyperloopPointer pointer:(const void *)&result encoding:@encode(CFStringRef)];
		CFStringRef v = *(CFStringRef *)[p pointerValue];
		XCTAssertEqual(v, result);
	}
}

- (void)testCharStarPointer {
	@autoreleasepool {
		HyperloopPointer *p = [HyperloopPointer encoding:@encode(char **)];
		char ** value = (char **)[p pointerValue];
		*value = "a";
		NSString *str = [p valueAtIndex:0];
		XCTAssertTrue(strstr(*value, [str UTF8String]) == *value);
	}
}

- (void)testURLStringify {
	@autoreleasepool {
		NSURL *url = [NSURL URLWithString:@"http://www.appcelerator.com"];
		HyperloopPointer *p = [HyperloopPointer pointer:(const void *)url encoding:@encode(id)];
		XCTAssertEqualObjects([url absoluteString], [p stringValue]);
		XCTAssertEqualObjects([url absoluteString], [HyperloopUtils stringify:p]);
		XCTAssertEqualObjects([url description], [p description]);
		XCTAssertEqualObjects([url absoluteString], [p performSelector:@selector(absoluteString)]);

		HyperloopClass *cls = [[HyperloopClass alloc] initWithClassName:@"NSURL" alloc:NO init:@selector(class) args:nil];
		id result = [HyperloopUtils invokeSelector:@selector(URLWithString:) args:@[@"http://www.appcelerator.com"] target:cls instance:NO];
		XCTAssertEqualObjects([url absoluteString], [result absoluteString]);
		XCTAssertEqualObjects([url description], [result description]);
	}
}

- (void)testNSDictionary {
	@autoreleasepool {
		NSDictionary *dictionary = @{
			@"key":@"value"
		};
		HyperloopPointer *p = [HyperloopPointer pointer:(const void *)dictionary encoding:@encode(id)];
		XCTAssertEqualObjects([dictionary description], [p stringValue]);
	}
}

- (void)testCleanup {
	// ensure that our object is being properly cleaned up (dealloc)
	@autoreleasepool {
		TestCleanupObject *t = [TestCleanupObject new];
		HyperloopPointer *p = [HyperloopPointer pointer:(const void *)t encoding:@encode(id)];
		XCTAssertTrue([p isEqual:t]);
		p = nil;
		t = nil;
	}
	XCTAssertEqual(testObjectDealloc, 1);
}

@end

#pragma clang diagnostic pop

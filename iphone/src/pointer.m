/**
 * Hyperloop Library
 * Copyright (c) 2015-Present by Appcelerator, Inc.
 */
#import <UIKit/UIKit.h>
#import "pointer.h"
#import "utils.h"
#ifdef TIMODULE
#import "HyperloopView.h"
#endif

#define DEALLOC_DEBUG 0

/**
 * remove the extranous struct from the C encoding such as the CGRect struct:
 *
 * @property (nonatomic, {CGPoint=dd}{CGSize=dd}}
 *
 * should return dddd
 */
static NSString *stringWithoutGarbage(NSString *str)
{
	NSRange r1 = [str rangeOfString:@"{"];
	NSRange r2 = [str rangeOfString:@"="];
	if (r1.location == NSNotFound || r2.location == NSNotFound) {
		// could be just {dd}
		str = [str stringByReplacingOccurrencesOfString:@"}" withString:@""];
		str = [str stringByReplacingOccurrencesOfString:@"{" withString:@""];
		return str;
	}

	NSRange range = NSMakeRange(r1.location, r2.location - r1.location + 1);
	NSString *result = [str stringByReplacingCharactersInRange:range withString:@""];
	result = [result stringByReplacingOccurrencesOfString:@"}" withString:@""];
	return stringWithoutGarbage(result);
}

NSString *cleanEncoding(NSString *encoding)
{
	const char ch = [encoding characterAtIndex:0];
	if (ch == 'r' || ch == 'n' || ch == 'N' || ch == 'o' || ch == 'O' || ch == 'R' || ch == 'V') {
		return [encoding substringFromIndex:1];
	}
	return encoding;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// HyperloopStruct
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

#pragma - mark HyperloopStruct

@implementation HyperloopStruct

- (instancetype)initWithEncoding:(NSString *)cencoding pointer:(const void *)pointer
{
	if (self = [self init]) {
		if (!pointer) {
			@throw [NSException exceptionWithName:@"InvalidArgument" reason:@"pointer cannot be NULL" userInfo:nil];
		}
		_encoding = cleanEncoding(cencoding);
		_encodings = [[NSMutableArray alloc] init];
		_flatencoding = stringWithoutGarbage(_encoding);
		_objects = [[NSMutableDictionary alloc] init];
		_size = 0;

#define GETENC(type, enc)                                                         \
	case enc: {                                                                   \
		[_encodings addObject:[NSNumber numberWithUnsignedInteger:sizeof(type)]]; \
		_size += sizeof(type);                                                    \
		break;                                                                    \
	}

		for (NSUInteger i = 0; i < [_flatencoding length]; i++) {
			const char ch = [_flatencoding characterAtIndex:i];
			switch (ch) {
				GETENC(double, 'd');
				GETENC(int, 'i');
				GETENC(float, 'f');
				GETENC(long, 'l');
				GETENC(short, 's');
				GETENC(bool, 'B');
				GETENC(char, 'c');
				GETENC(long long, 'q');
				GETENC(unsigned char, 'C');
				GETENC(unsigned int, 'I');
				GETENC(unsigned short, 'S');
				GETENC(unsigned long, 'L');
				GETENC(unsigned long long, 'Q');
				case '*': {
					//TODO: not sure this is correct
					[_encodings addObject:[NSNumber numberWithUnsignedInteger:sizeof(char *)]];
					_size += sizeof(char *);
					break;
				}
				case '@': {
					[_encodings addObject:[NSNumber numberWithUnsignedInteger:sizeof(id)]];
					_size += sizeof(id);
					break;
				}
				case '#': {
					[_encodings addObject:[NSNumber numberWithUnsignedInteger:sizeof(Class)]];
					_size += sizeof(Class);
					break;
				}
				case ':': {
					[_encodings addObject:[NSNumber numberWithUnsignedInteger:sizeof(SEL)]];
					_size += sizeof(SEL);
					break;
				}
				case '^': {
					i++;
					[_encodings addObject:[NSNumber numberWithUnsignedInteger:sizeof(void *)]];
					_size += sizeof(void *);
					break;
				}
			}
		}
		if (_size) {
			_pointer = malloc(_size);
			memset(_pointer, '\0', _size);
			memcpy(_pointer, pointer, _size);
		}
	}
	REMEMBER(self);
	return self;
}

+ (instancetype)structWithEncoding:(NSString *)encoding pointer:(const void *)_pointer
{
	return [[HyperloopStruct alloc] initWithEncoding:encoding pointer:_pointer];
}

- (void)setValue:(const void *)value
{
	memcpy(_pointer, value, _size);
}

- (id)iterate:(NSUInteger)index callback:(id (^)(char ch, void *tmp))callback
{
	void *tmp = _pointer;
	for (NSUInteger i = 0; i <= index; i++) {
		NSNumber *enc = [_encodings objectAtIndex:i];
		if (i == index) {
			char ch = [_flatencoding characterAtIndex:i];
			if (ch == '^') {
				i++;
			}
			return callback(ch, tmp);
		}
		tmp += [enc unsignedIntegerValue];
	}
	return nil;
}

- (id)valueAtIndex:(NSUInteger)index
{
	return [self iterate:index
	            callback:^id(char ch, void *p) {
		          switch (ch) {
			          case 'd':
				          return [NSNumber numberWithDouble:*(double *)p];
			          case 'i':
				          return [NSNumber numberWithInt:*(int *)p];
			          case 'l':
				          return [NSNumber numberWithLong:*(long *)p];
			          case 's':
				          return [NSNumber numberWithShort:*(short *)p];
			          case 'f':
				          return [NSNumber numberWithFloat:*(float *)p];
			          case 'B':
				          return [NSNumber numberWithBool:*(bool *)p];
			          case 'c':
				          return [NSNumber numberWithChar:*(char *)p];
			          case 'q':
				          return [NSNumber numberWithLongLong:*(long long *)p];
			          case 'C':
				          return [NSNumber numberWithUnsignedChar:*(unsigned char *)p];
			          case 'I':
				          return [NSNumber numberWithUnsignedInt:*(unsigned int *)p];
			          case 'S':
				          return [NSNumber numberWithUnsignedShort:*(unsigned short *)p];
			          case 'L':
				          return [NSNumber numberWithUnsignedLong:*(unsigned long *)p];
			          case 'Q':
				          return [NSNumber numberWithUnsignedLongLong:*(unsigned long long *)p];
			          case ':': {
				          id obj = [_objects objectForKey:[NSString stringWithFormat:@"%lu", (unsigned long)index]];
				          if ([obj isKindOfClass:[NSString class]]) {
					          SEL sel = NSSelectorFromString(obj);
					          return [HyperloopPointer pointer:sel encoding:@encode(SEL)];
				          } else {
					          NSLog(@"[ERROR] Not sure what type of object SEL is at %lu", (unsigned long)index);
				          }
				          break;
			          }
			          case '#':
			          case '^':
			          case '@': {
				          id obj = [_objects objectForKey:[NSString stringWithFormat:@"%lu", (unsigned long)index]];
				          return [HyperloopPointer pointer:(__bridge const void *)(obj) encoding:[[NSString stringWithFormat:@"%c", ch] UTF8String]];
			          }
			          default:
				          break;
		          }
		          return nil;
		        }];
}

- (void)valueAtIndex:(NSUInteger)index pointer:(void *)ptr
{
	__block void **resultp = (void **)ptr;
	[self iterate:index
	     callback:^id(char ch, void *p) {
		   switch (ch) {
			   case 'd':
				   *(double *)ptr = [[NSNumber numberWithDouble:*(double *)p] doubleValue];
				   break;
			   case 'i':
				   *(int *)ptr = [[NSNumber numberWithInt:*(int *)p] intValue];
				   break;
			   case 'l':
				   *(long *)ptr = [[NSNumber numberWithLong:*(long *)p] longValue];
				   break;
			   case 's':
				   *(short *)ptr = [[NSNumber numberWithLong:*(short *)p] shortValue];
				   break;
			   case 'f':
				   *(float *)ptr = [[NSNumber numberWithDouble:*(float *)p] floatValue];
				   break;
			   case 'B':
				   *(bool *)ptr = [[NSNumber numberWithBool:*(bool *)p] boolValue];
				   break;
			   case 'c':
				   *(char *)ptr = [[NSNumber numberWithChar:*(char *)p] charValue];
				   break;
			   case 'q':
				   *(long long *)ptr = [[NSNumber numberWithLongLong:*(long long *)p] longLongValue];
				   break;
			   case 'C':
				   *(unsigned char *)ptr = [[NSNumber numberWithUnsignedChar:*(unsigned char *)p] unsignedCharValue];
				   break;
			   case 'I':
				   *(unsigned int *)ptr = [[NSNumber numberWithUnsignedInt:*(unsigned int *)p] unsignedIntValue];
				   break;
			   case 'S':
				   *(unsigned short *)ptr = [[NSNumber numberWithUnsignedShort:*(unsigned short *)p] unsignedShortValue];
				   break;
			   case 'L':
				   *(unsigned long *)ptr = [[NSNumber numberWithUnsignedLong:*(unsigned long *)p] unsignedLongValue];
				   break;
			   case 'Q':
				   *(unsigned long long *)ptr = [[NSNumber numberWithUnsignedLongLong:*(unsigned long long *)p] unsignedLongLongValue];
				   break;
			   case ':': {
				   id obj = [_objects objectForKey:[NSString stringWithFormat:@"%lu", (unsigned long)index]];
				   if ([obj isKindOfClass:[NSString class]]) {
					   *(SEL *)ptr = NSSelectorFromString(obj);
				   } else {
					   NSLog(@"[ERROR] Not sure what type of object SEL is at %lu", (unsigned long)index);
				   }
				   break;
			   }
			   case '#':
			   case '^':
			   case '@': {
				   id obj = [_objects objectForKey:[NSString stringWithFormat:@"%lu", (unsigned long)index]];
				   // must retain since the other since will autorelease it
				   *resultp = (__bridge_retained void *)(obj);
				   break;
			   }
			   default:
				   break;
		   }
		   return nil;
		 }];
}

- (void)setValue:(id)v atIndex:(NSUInteger)index
{
#define SETVAL(t, type, n)                          \
	case t: {                                       \
		*(type *)p = [HyperloopPointer n##Value:v]; \
		return nil;                                 \
	}

	[self iterate:index
	     callback:^id(char ch, void *p) {
		   switch (ch) {
			   SETVAL('d', double, double);
			   SETVAL('i', int, int);
			   SETVAL('I', unsigned int, unsignedInt);
			   SETVAL('s', short, short);
			   SETVAL('S', unsigned short, unsignedShort);
			   SETVAL('f', float, float);
			   SETVAL('l', long, long);
			   SETVAL('L', unsigned long, unsignedLong);
			   SETVAL('c', char, char);
			   SETVAL('q', long long, longLong);
			   SETVAL('Q', unsigned long long, unsignedLongLong);
			   SETVAL('B', bool, bool);
			   SETVAL('C', unsigned char, unsignedChar);
			   case '@':
			   case '#':
			   case '*': {
				   [_objects setObject:v forKey:[NSString stringWithFormat:@"%lu", (unsigned long)index]];
				   break;
			   }
			   case ':': {
				   if ([v isKindOfClass:[NSString class]]) {
					   [_objects setObject:v forKey:[NSString stringWithFormat:@"%lu", (unsigned long)index]];
				   } else {
					   NSLog(@"[ERROR] not sure how to handle SEL type of class %@", [v class]);
				   }
				   break;
			   }
			   case '^': {
				   if ([v isKindOfClass:[HyperloopPointer class]]) {
					   [_objects setObject:v forKey:[NSString stringWithFormat:@"%lu", (unsigned long)index]];
				   } else {
					   NSLog(@"[ERROR] not sure how to handle pointer type of class %@", [v class]);
				   }
				   break;
			   }
			   default:
				   break;
		   }
		   return nil;
		 }];
}

- (const void *)pointerValue
{
	return _pointer;
}

- (void)dealloc
{
#if defined(DEALLOC_DEBUG) && DEALLOC_DEBUG == 1
	NSLog(@"dealloc %p -> %@", self, self);
#endif
	RELEASE_AND_CHECK(_encoding);
	RELEASE_AND_CHECK(_encodings);
	RELEASE_AND_CHECK(_flatencoding);
	RELEASE_AND_CHECK(_objects);
	free(_pointer);
	_pointer = nil;
	FORGET(self);
}

@end

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// HyperloopValue
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

#pragma - mark HyperloopValue

@implementation HyperloopValue

- (instancetype)initWithObject:(NSObject *)object isPointer:(BOOL)pointer
{
	if (self = [self init]) {
		_object = object;
		_clazz = nil;
		_pointer = pointer;
	}
#if defined(DEALLOC_DEBUG) && DEALLOC_DEBUG == 1
	NSLog(@"alloc %p -> %@", self, self);
#endif
	REMEMBER(self);
	return self;
}

- (instancetype)initWithClass:(Class)cls
{
	if (self = [super init]) {
		_object = nil;
		_clazz = cls;
		_pointer = NO;
	}
	REMEMBER(self);
	return self;
}

- (instancetype)initWithSelector:(SEL)sel
{
	if (self = [super init]) {
		_object = nil;
		_clazz = nil;
		_selector = NSStringFromSelector(sel);
		_pointer = NO;
		if (_selector == nil) {
			@throw [NSException exceptionWithName:@"InvalidArgument" reason:@"selector was not valid. maybe it was a SEL * instead of a SEL?" userInfo:nil];
		}
	}
	REMEMBER(self);
	return self;
}

- (void)dealloc
{
#if defined(DEALLOC_DEBUG) && DEALLOC_DEBUG == 1
	NSLog(@"dealloc %p -> %@", self, self);
#endif
	RELEASE_AND_CHECK(_object);
	RELEASE_AND_CHECK(_clazz);
	RELEASE_AND_CHECK(_selector);
	FORGET(self);
}

#if defined(DEALLOC_DEBUG) && DEALLOC_DEBUG == 1
- (instancetype)retain
{
	NSLog(@"retain %p -> %@ %lu", self, self, [self retainCount]);
	return [super retain];
}

- (oneway void)release
{
	NSLog(@"release %p -> %@ %lu", self, self, [self retainCount]);
	[super release];
}
#endif

- (BOOL)respondsToSelector:(SEL)aSelector
{
	if ([_object respondsToSelector:aSelector]) {
		return YES;
	}
	if ([_clazz respondsToSelector:aSelector]) {
		return YES;
	}
	return [super respondsToSelector:aSelector];
}

- (NSMethodSignature *)methodSignatureForSelector:(SEL)aSelector
{
	if ([_object respondsToSelector:aSelector]) {
		return [_object methodSignatureForSelector:aSelector];
	} else if ([_clazz respondsToSelector:aSelector]) {
		return [_clazz methodSignatureForSelector:aSelector];
	} else if ([self respondsToSelector:aSelector]) {
		return [super methodSignatureForSelector:aSelector];
	}
	NSLog(@"[ERROR] does not recognize selector %@ for %@", NSStringFromSelector(aSelector), [self class]);
	[self doesNotRecognizeSelector:aSelector];
	return nil;
}

- (BOOL)isEqual:(id)obj
{
	if ([_object isEqual:obj]) {
		return YES;
	} else if (_clazz == (Class)obj) {
		return YES;
	}
	return [super isEqual:obj];
}

- (BOOL)isKindOfClass:(Class)aClass
{
	if ([_object isKindOfClass:aClass]) {
		return YES;
	} else if ([(id)_clazz isKindOfClass:aClass] || aClass == _clazz) {
		return YES;
	}
	return [super isKindOfClass:aClass];
}

- (void)getValue:(void *)ptr
{
	if (_object && [_object isKindOfClass:[NSValue class]]) {
		if (_pointer) {
			void *p = [(NSValue *)_object pointerValue];
			if (p) {
				ptr = p;
				return;
			}
		}
		[(NSValue *)_object getValue:ptr];
	} else if (_object && [_object isKindOfClass:[NSString class]]) {
		NSString *s = (NSString *)_object;
		NSUInteger len = [self length];
		[s getCString:(char *)ptr maxLength:len + 1 encoding:NSUTF8StringEncoding];
	} else if (_object && [_object isKindOfClass:[NSObject class]]) {
		ptr = (__bridge void *)(_object);
	} else if (_clazz) {
		ptr = (__bridge void *)(_clazz);
	} else if (_selector) {
		SEL *p = (SEL *)ptr;
		*p = NSSelectorFromString(_selector);
	} else {
		NSLog(@"[ERROR] getValue not sure what type of object this is %@", self);
	}
}

- (NSObject *)getObject
{
	return _object;
}

- (Class)getClass
{
	return _clazz;
}

+ (NSUInteger)lengthForEncoding:(const char *)encoding
{
	NSUInteger size = 0, length = 0;
	while (strlen(encoding)) {
		encoding = NSGetSizeAndAlignment(encoding, &length, NULL);
		size += length;
	}
	return size;
}

- (NSUInteger)length
{
	if ([_object isKindOfClass:[NSValue class]]) {
		return [HyperloopValue lengthForEncoding:[(NSValue *)_object objCType]];
	} else if ([_object isKindOfClass:[NSString class]]) {
		return [(NSString *)_object length];
	} else if ([_object isKindOfClass:[NSObject class]]) {
		NSUInteger size = 0;
		NSGetSizeAndAlignment(@encode(id), NULL, &size);
		return size;
	} else if (_clazz) {
		NSUInteger size = 0;
		NSGetSizeAndAlignment(@encode(Class), NULL, &size);
		return size;
	} else if (_selector) {
		NSUInteger size = 0;
		NSGetSizeAndAlignment(@encode(SEL), NULL, &size);
		return size;
	}
	return 0;
}

@end

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// HyperloopPointer
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

#pragma - mark HyperloopPointer

@implementation HyperloopPointer

@synthesize nativeObject = _nativeObject;
+ (void *)createMemoryForEncoding:(const char *)encoding pointer:(const void *)pointer
{
	NSUInteger size = [HyperloopValue lengthForEncoding:encoding];
#if defined(DEALLOC_DEBUG) && DEALLOC_DEBUG == 1
	NSLog(@"creating %lu bytes of memory with encoding %s", size, encoding);
#endif
	NSMutableData *pointerData;
	if (pointer) {
		pointerData = [NSMutableData dataWithBytes:pointer length:size];
	} else {
		pointerData = [NSMutableData dataWithLength:size];
	}
	return [pointerData mutableBytes];
}

- (void)setValue:(const void *)pointer encoding:(const char *)encoding assign:(BOOL)assign
{
	RELEASE_AND_CHECK(_value);
	RELEASE_AND_CHECK(_structure);
	if (_pointer) {
		_pointer = nil;
	}
	id obj = nil;
	Class cls = nil;
	const char *sencoding = [cleanEncoding([NSString stringWithUTF8String:encoding]) UTF8String];
	if (strstr(sencoding, @encode(id)) == sencoding) {
		obj = (__bridge id)pointer;
	} else if (strstr(sencoding, @encode(Class)) == sencoding) {
		cls = (__bridge Class)pointer;
	}
	if (strstr(sencoding, "*") == sencoding) {
		// https://developer.apple.com/library/mac/documentation/Cocoa/Conceptual/NumbersandValues/Articles/Values.html
		// must only store pointers of constant length, which excludes C strings, variable-length arrays, etc
		_value = [[HyperloopValue alloc] initWithObject:[NSString stringWithUTF8String:(const char *)pointer] isPointer:NO];
		_pointer = nil;
	} else if (obj) {
		_value = [[HyperloopValue alloc] initWithObject:obj isPointer:NO];
		_pointer = nil;
	} else if (cls) {
		_value = [[HyperloopValue alloc] initWithClass:cls];
		_pointer = nil;
	} else if (sencoding[0] == '{' || (sencoding[0] == '^' && sencoding[1] == '{')) {
		_structure = [HyperloopStruct structWithEncoding:[NSString stringWithUTF8String:sencoding] pointer:pointer];
		_pointer = nil;
		_value = nil;
	} else if (sencoding[0] == ':') {
		_value = [[HyperloopValue alloc] initWithSelector:(SEL)pointer];
		_pointer = nil;
		_structure = nil;
	} else {
		if (!assign) {
			_pointer = [HyperloopPointer createMemoryForEncoding:sencoding pointer:pointer];
		} else {
			_pointer = (void *)pointer;
		}
		if (sencoding[0] == '^') {
			_value = [[HyperloopValue alloc] initWithObject:[NSValue valueWithPointer:_pointer] isPointer:YES];
		} else {
			_value = [[HyperloopValue alloc] initWithObject:[NSValue valueWithBytes:_pointer objCType:sencoding] isPointer:NO];
		}
	}
}

- (instancetype)initWithPointer:(const void *)pointer encoding:(const char *)encoding assign:(BOOL)assign framework:(NSString *)framework classname:(NSString *)classname
{
	if (self = [self init]) {
		assert(encoding);
		[self setValue:pointer encoding:encoding assign:assign];
		_encoding = cleanEncoding([NSString stringWithUTF8String:encoding]);
		_nativeObject = [_value getObject];
		_framework = framework;
		_classname = classname;
	}
#if defined(DEALLOC_DEBUG) && DEALLOC_DEBUG == 1
	NSLog(@"alloc %p -> %@", self, self);
#endif
	REMEMBER(self);
	return self;
}

+ (instancetype)pointer:(const void *)pointer encoding:(const char *)encoding framework:(NSString *)framework classname:(NSString *)classname
{
	return [[HyperloopPointer alloc] initWithPointer:pointer encoding:encoding assign:NO framework:framework classname:classname];
}

+ (instancetype)pointer:(const void *)pointer encoding:(const char *)encoding
{
	return [[HyperloopPointer alloc] initWithPointer:pointer encoding:encoding assign:NO framework:nil classname:nil];
}

+ (instancetype)create:(const void *)pointer encoding:(const char *)encoding
{
	return [[HyperloopPointer alloc] initWithPointer:pointer encoding:encoding assign:YES framework:nil classname:nil];
}

+ (instancetype)encoding:(const char *)encoding
{
	void *pointer = [HyperloopPointer createMemoryForEncoding:encoding pointer:nil];
	return [[HyperloopPointer alloc] initWithPointer:pointer encoding:encoding assign:YES framework:nil classname:nil];
}

#define GETVALUE(type, name, def)                                         \
	-(type)name##Value                                                    \
	{                                                                     \
		type v = def;                                                     \
		[_value getValue:&v];                                             \
		return v;                                                         \
	}                                                                     \
                                                                          \
	+(type)name##Value : (id)value                                        \
	{                                                                     \
		if (value && [value respondsToSelector:@selector(name##Value)]) { \
			return [value name##Value];                                   \
		}                                                                 \
		return def;                                                       \
	}

#define GETVALUEFMT(type, type2, name, def, fmt) \
	-(type)name##Value                           \
	{                                            \
		type2 v = def;                           \
		[_value getValue:&v];                    \
		return fmt(v);                           \
	}

GETVALUE(float, float, 0.0f);
GETVALUE(int, int, 0);
GETVALUE(long, long, 0);
GETVALUE(short, short, 0);
GETVALUE(double, double, 0);
GETVALUE(char, char, '\0');
GETVALUE(bool, bool, false);
GETVALUE(long long, longLong, 0);
GETVALUE(unsigned int, unsignedInt, 0);
GETVALUE(unsigned long, unsignedLong, 0);
GETVALUE(unsigned long long, unsignedLongLong, 0);
GETVALUE(unsigned short, unsignedShort, 0);
GETVALUE(unsigned char, unsignedChar, '\0');
GETVALUEFMT(NSString *, SEL, selector, nil, NSStringFromSelector);

- (void *)pointerValue
{
	if (_structure) {
		return (void *)[_structure pointerValue];
	}
	if ([_encoding characterAtIndex:0] == '^') {
		return _pointer;
	}
	void *ptr = NULL;
	[_value getValue:ptr];
	return ptr;
}

+ (void *)pointerValue:(id)value
{
	return nil;
}

+ (NSString *)selectorValue:(id)value
{
	void *p = (__bridge void *)value;
	SEL sel = (SEL)p;
	return NSStringFromSelector(sel);
}

#define STRVALUE(type, format, fn)                                    \
	if (strstr(encoding, @encode(type)) == encoding) {                \
		return [NSString stringWithFormat:@format, [self fn##Value]]; \
	}

- (void)dealloc
{
#if defined(DEALLOC_DEBUG) && DEALLOC_DEBUG == 1
	NSLog(@"dealloc %p -> %@", self, self);
#endif
	RELEASE_AND_CHECK(_value);
	RELEASE_AND_CHECK(_structure);
	RELEASE_AND_CHECK(_framework);
	RELEASE_AND_CHECK(_classname);
#ifndef TIMODULE
	RELEASE_AND_CHECK(_nativeObject);
#endif
	if (_pointer) {
		_pointer = nil;
	}
	FORGET(self);
}

- (NSObject *)objectValue
{
	return [_value getObject];
}

- (Class)classValue
{
	return [_value getClass];
}

+ (NSObject *)objectValue:(id)value
{
	return value;
}

+ (Class)classValue:(id)value
{
	if ([value isKindOfClass:[NSObject class]]) {
		return [value class];
	}
	return (Class)value;
}

- (NSString *)stringValue
{
	const char *encoding = [_encoding UTF8String];

	STRVALUE(float, "%f", float);
	STRVALUE(int, "%d", int);
	STRVALUE(long, "%ld", long);
	STRVALUE(short, "%d", short);
	STRVALUE(double, "%lf", double);
	STRVALUE(char, "%c", char);
	STRVALUE(long long, "%lld", longLong);
	STRVALUE(unsigned int, "%u", unsignedInt);
	STRVALUE(unsigned long, "%lu", unsignedLong);
	STRVALUE(unsigned long long, "%llu", unsignedLongLong);
	STRVALUE(unsigned short, "%hu", unsignedShort);
	STRVALUE(unsigned char, "%c", unsignedChar);
	STRVALUE(void *, "%p", pointer);

	if (strstr(encoding, @encode(char *)) == encoding) {
		char *str = (char *)malloc([_value length] + 1);
		[_value getValue:str];
		NSString *result = [NSString stringWithUTF8String:str];
		free(str);
		return result;
	}

	if (strstr(encoding, @encode(bool)) == encoding) {
		bool b = false;
		[_value getValue:&b];
		return b ? @"true" : @"false";
	}

	if (strstr(encoding, @encode(SEL)) == encoding) {
		SEL sel = nil;
		[_value getValue:&sel];
		if (sel) {
			return NSStringFromSelector(sel);
		}
	}

	if (strstr(encoding, @encode(id)) == encoding) {
		return [[_value getObject] description];
	}

	if (strstr(encoding, @encode(Class)) == encoding) {
		return [[_value getClass] description];
	}

	// just print out the encoding type
	return [NSString stringWithFormat:@"[Pointer %p %@]", self, _encoding];
}

+ (NSString *)stringValue:(id)value
{
	if ([value isKindOfClass:[NSNumber class]]) {
		const char *enc = [(NSValue *)value objCType];
		if (strstr(enc, @encode(char)) == enc) {
			char ch = [value charValue];
			return [NSString stringWithFormat:@"%c", ch];
		}
	}
	if ([value respondsToSelector:@selector(stringValue)]) {
		return [value stringValue];
	}
	return [value description];
}

/**
 * by default, the string representation of this object is simply the string value
 */
- (NSString *)description
{
	return [self stringValue];
}

#define OBJECTAT(t, type, name)                        \
	case t: {                                          \
		void *v = malloc(len);                         \
		memset(v, '\0', len);                          \
		[_value getValue:v];                           \
		NSUInteger i = 0, align = 0;                   \
		const void *tmp = v;                           \
		NSGetSizeAndAlignment(encoding, NULL, &align); \
		while (i++ < index) {                          \
			tmp += align;                              \
		}                                              \
		type vv = *(type *)tmp;                        \
		NSNumber *p = [NSNumber numberWith##name:vv];  \
		free(v);                                       \
		return p;                                      \
	}

- (id)valueAtIndex:(NSUInteger)index withEncoding:(const char *)encoding withLength:(NSUInteger)len
{
	switch (encoding[0]) {
		OBJECTAT('f', float, Float);
		OBJECTAT('i', int, Int);
		OBJECTAT('l', long, Long);
		OBJECTAT('d', double, Double);
		OBJECTAT('B', bool, Bool);
		OBJECTAT('s', short, Short);
		OBJECTAT('c', char, Char);
		OBJECTAT('q', long long, LongLong);
		OBJECTAT('C', unsigned char, UnsignedChar);
		OBJECTAT('I', unsigned int, UnsignedInt);
		OBJECTAT('S', unsigned short, UnsignedShort);
		OBJECTAT('L', unsigned long, UnsignedLong);
		OBJECTAT('Q', unsigned long long, UnsignedLongLong);
		default:
			break;
	}
	if (encoding[0] == '^') {
		// pointer
		void *p = [self pointerValue];
		const char *newencoding = [[NSString stringWithFormat:@"%c", encoding[1]] UTF8String];
		if (encoding[1] == '*') {
			p = *(char **)p;
		} else {
			NSUInteger i = 0, align = 0;
			void *tmp = p;
			NSGetSizeAndAlignment(newencoding, NULL, &align);
			while (i++ < index) {
				tmp += align;
			}
			p = tmp;
		}
		if (encoding[1] == ':') {
			p = *(SEL *)p;
		}
		return [HyperloopPointer pointer:p encoding:newencoding];
	} else if (strstr(encoding, "*") == encoding) {
		// char *
		char *v = malloc([_value length] + 1);
		[_value getValue:v];
		char v2 = v[index];
		HyperloopPointer *result = [HyperloopPointer pointer:&v2 encoding:@encode(char)];
		free(v);
		return result;
	} else if (encoding[0] == '[') {
		// array
		char *enc = (char *)encoding;
		enc++;
		char encoding = '\0';
		while (enc) {
			char ch = *enc;
			if (ch == ']')
				break;
			if (!isdigit(ch)) {
				encoding = ch;
				break;
			}
			enc++;
		}
		void *pointer = malloc(len);
		[_value getValue:pointer];
		NSUInteger i = 0, align = 0;
		void *tmp = pointer;
		const char *newencoding = [[NSString stringWithFormat:@"%c", encoding] UTF8String];
		NSGetSizeAndAlignment(newencoding, NULL, &align);
		while (i++ < index) {
			tmp += align;
		}
		id result = [HyperloopPointer pointer:tmp encoding:newencoding];
		free(pointer);
		return result;
	} else if (encoding[0] == '@') {
		return [self objectValue];
	} else if (encoding[0] == '#') {
		return [self classValue];
	}
	NSLog(@"[ERROR] unknown encoding (valueAtIndex): %s", encoding);
	return nil;
}

- (id)valueAtIndex:(NSUInteger)index
{
	if (_structure) {
		return [_structure valueAtIndex:index];
	} else {
		const char *enc = [_encoding UTF8String];
		return [self valueAtIndex:index withEncoding:enc withLength:[self length]];
	}
	return nil;
}

#define SETOBJECTAT(t, type, name)                                           \
	case t: {                                                                \
		if (len == 0) {                                                      \
			return;                                                          \
		}                                                                    \
		void *v = malloc(len);                                               \
		[_value getValue:v];                                                 \
		NSUInteger i = 0, align = 0;                                         \
		const char *encoding = [[NSString stringWithString:enc] UTF8String]; \
		const void *tmp = v;                                                 \
		NSGetSizeAndAlignment(encoding, NULL, &align);                       \
		while (i++ < index) {                                                \
			tmp += align;                                                    \
		}                                                                    \
		type nv = [HyperloopPointer name##Value:value];                      \
		*(type *)tmp = nv;                                                   \
		[self setValue:v encoding:[_encoding UTF8String] assign:YES];        \
		return;                                                              \
	}

- (void)setValue:(id)value atIndex:(NSUInteger)index
{
	if (_structure) {
		NSString *enc = stringWithoutGarbage(_encoding);
		NSUInteger len = [enc length];
		if (len == 0) {
			@throw [NSException exceptionWithName:@"InvalidArgument" reason:[NSString stringWithFormat:@"encoding was not valid %@", _encoding] userInfo:nil];
			return;
		}
		if (index >= len) {
			@throw [NSException exceptionWithName:@"InvalidArgument" reason:[NSString stringWithFormat:@"element at %lu > %lu length", (unsigned long)index, (unsigned long)len] userInfo:nil];
			return;
		} else {
			return [_structure setValue:value atIndex:index];
		}
	} else {
		const char *encoding = [_encoding UTF8String];
		NSString *enc = [NSString stringWithString:_encoding];
		if (strstr(encoding, @encode(char *)) == encoding) {
			NSMutableString *existing = [NSMutableString stringWithString:[self stringValue]];
			NSString *newstr = [HyperloopPointer stringValue:value];
			if ([existing length]) {
				[existing replaceCharactersInRange:NSMakeRange(index, [newstr length]) withString:newstr];
			} else {
				[existing appendString:newstr];
			}
			const char *v = [existing UTF8String];
			return [self setValue:v encoding:encoding assign:NO];
		} else if (strstr(encoding, @encode(id)) == encoding) {
			return [self setValue:(__bridge const void *)(value) encoding:encoding assign:NO];
		} else if (strstr(encoding, @encode(Class)) == encoding) {
			return [self setValue:(__bridge const void *)(value) encoding:encoding assign:NO];
		} else if (strstr(encoding, @encode(SEL)) == encoding) {
			return [self setValue:(__bridge const void *)(value) encoding:encoding assign:NO];
		} else if (encoding[0] == '^') {
			// pointer, skip forward
			encoding++;
			enc = [NSString stringWithUTF8String:encoding];
		}
		NSUInteger len = [self length];
		switch (encoding[0]) {
			SETOBJECTAT('f', float, float);
			SETOBJECTAT('i', int, int);
			SETOBJECTAT('l', long, long);
			SETOBJECTAT('d', double, double);
			SETOBJECTAT('B', bool, bool);
			SETOBJECTAT('s', short, short);
			SETOBJECTAT('c', char, char);
			SETOBJECTAT('q', long long, longLong);
			SETOBJECTAT('C', unsigned char, unsignedChar);
			SETOBJECTAT('I', unsigned int, unsignedInt);
			SETOBJECTAT('S', unsigned short, unsignedShort);
			SETOBJECTAT('L', unsigned long, unsignedLong);
			SETOBJECTAT('Q', unsigned long long, unsignedLongLong);
			default:
				break;
		}
	}
	@throw [NSException exceptionWithName:@"InvalidArgument" reason:[NSString stringWithFormat:@"element at %lu, not supported encoding %@", (unsigned long)index, _encoding] userInfo:nil];
}

#define OBJECTATPTR(t, type)                           \
	case t: {                                          \
		[_value getValue:pointer];                     \
		NSUInteger i = 0, align = 0;                   \
		const void *tmp = pointer;                     \
		NSGetSizeAndAlignment(encoding, NULL, &align); \
		while (i++ < index) {                          \
			tmp += align;                              \
		}                                              \
		type vv = *(type *)tmp;                        \
		*(type *)pointer = vv;                         \
		return;                                        \
	}

- (void)getValue:(NSUInteger)index withEncoding:(const char *)encoding pointer:(void *)pointer
{
	switch (encoding[0]) {
		OBJECTATPTR('f', float);
		OBJECTATPTR('i', int);
		OBJECTATPTR('l', long);
		OBJECTATPTR('d', double);
		OBJECTATPTR('B', bool);
		OBJECTATPTR('s', short);
		OBJECTATPTR('c', char);
		OBJECTATPTR('q', long long);
		OBJECTATPTR('C', unsigned char);
		OBJECTATPTR('I', unsigned int);
		OBJECTATPTR('S', unsigned short);
		OBJECTATPTR('L', unsigned long);
		OBJECTATPTR('Q', unsigned long long);
		OBJECTATPTR(':', SEL);
		case '@': {
			[_value getValue:pointer];
			NSUInteger i = 0, align = 0;
			const void *tmp = pointer;
			NSGetSizeAndAlignment(encoding, NULL, &align);
			while (i++ < index) {
				tmp += align;
			}
			void *vv = *(void **)tmp;
			pointer = vv;
			return;
		}
			// * is called before getting here
			OBJECTATPTR('#', Class);
		default:
			break;
	}
	NSLog(@"[ERROR] unknown encoding (getValue): %s", encoding);
}

- (void)getValue:(NSUInteger)index pointer:(void *)pointer
{
	const char *encoding = [_encoding UTF8String];
	if (encoding[0] == '^') {
		[self getValue:index withEncoding:[[NSString stringWithFormat:@"%c", encoding[1]] UTF8String] pointer:pointer];
	} else if (strstr(encoding, "*") == encoding) {
		char *v = malloc([_value length] + 1);
		[_value getValue:v];
		char v2 = v[index];
		*(char *)pointer = v2;
		free(v);
	} else if (_structure) {
		[_structure valueAtIndex:index pointer:pointer];
	} else {
		[self getValue:index withEncoding:encoding pointer:pointer];
	}
}

/**
 * return the size of the underlying pointer memory
 */
- (NSUInteger)length
{
	return [_value length];
}

- (BOOL)respondsToSelector:(SEL)aSelector
{
	if ([_value respondsToSelector:aSelector]) {
		return YES;
	}
	return [super respondsToSelector:aSelector];
}

- (NSMethodSignature *)methodSignatureForSelector:(SEL)aSelector
{
	if ([_value respondsToSelector:aSelector]) {
		return [_value methodSignatureForSelector:aSelector];
	} else if ([self respondsToSelector:aSelector]) {
		return [super methodSignatureForSelector:aSelector];
	}
	NSLog(@"[ERROR] does not recognize selector %@ for %@ (encoding=%@) %@", NSStringFromSelector(aSelector), [self class], _encoding, self);
	NSLog(@"[ERROR] call stack was: %@", [NSThread callStackSymbols]);
	[self doesNotRecognizeSelector:aSelector];
	return nil;
}

- (void)forwardInvocation:(NSInvocation *)forwardedInvocation
{
	if ([_value respondsToSelector:forwardedInvocation.selector]) {
		if ([_value getObject]) {
			[forwardedInvocation setTarget:[_value getObject]];
		} else {
			[forwardedInvocation setTarget:[_value getClass]];
		}
	}
	[forwardedInvocation invoke];
}

- (BOOL)isEqual:(id)obj
{
	if ([_value isEqual:obj]) {
		return YES;
	}
	return [super isEqual:obj];
}

- (BOOL)isKindOfClass:(Class)aClass
{
	if ([_value isKindOfClass:aClass]) {
		return YES;
	}
	if ([(id)aClass isKindOfClass:[HyperloopPointer class]] || aClass == [HyperloopPointer class]) {
		return YES;
	}
	return [super isKindOfClass:aClass];
}

#define GETENCODING(type, name)                               \
	-(NSString *)name##Encoding                               \
	{                                                         \
		return [NSString stringWithUTF8String:@encode(type)]; \
	}                                                         \
	+(NSString *)name##Encoding                               \
	{                                                         \
		return [NSString stringWithUTF8String:@encode(type)]; \
	}

GETENCODING(bool, bool);
GETENCODING(int, int);
GETENCODING(char, char);
GETENCODING(float, float);
GETENCODING(long, long);
GETENCODING(double, double);
GETENCODING(short, short);
GETENCODING(id, object);
GETENCODING(Class, class);
GETENCODING(SEL, selector);
GETENCODING(void *, pointer);
GETENCODING(char *, string);
GETENCODING(long long, longLong);
GETENCODING(unsigned int, unsignedInt);
GETENCODING(unsigned char, unsignedChar);
GETENCODING(unsigned short, unsignedShort);
GETENCODING(unsigned long, unsignedLong);
GETENCODING(unsigned long long, unsignedLongLong);
GETENCODING(float *, floatPointer);
GETENCODING(int *, intPointer);
GETENCODING(short *, shortPointer);
GETENCODING(bool *, boolPointer);
GETENCODING(double *, doublePointer);
GETENCODING(long *, longPointer);

#define SETARG(ch, type)                               \
	case ch: {                                         \
		type value;                                    \
		[self getValue:0 pointer:&value];              \
		[invocation setArgument:&value atIndex:index]; \
		break;                                         \
	}

- (void)setArgument:(NSInvocation *)invocation atIndex:(NSUInteger)index
{
	if (_structure) {
		void *pv = (void *)[_structure pointerValue];
		[invocation setArgument:pv atIndex:index];
	} else {
		char ch = [_encoding characterAtIndex:0];
		if (ch == '^') {
			void *p = [self pointerValue];
			[invocation setArgument:&p atIndex:index];
		} else {
			switch (ch) {
				SETARG('i', int);
				SETARG('d', double);
				SETARG('f', float);
				SETARG('s', short);
				SETARG('c', char);
				SETARG('l', long);
				SETARG('B', bool);
				SETARG('q', long long);
				SETARG('C', unsigned char);
				SETARG('I', unsigned int);
				SETARG('S', unsigned short);
				SETARG('L', unsigned long);
				SETARG('Q', unsigned long long);
				SETARG(':', SEL);
				case '#': {
					Class cls = [self classValue];
					[invocation setArgument:&cls atIndex:index];
					break;
				}
				case '@': {
					id obj = [self objectValue];
					[HyperloopUtils unmarshalObject:invocation arg:obj index:index];
					break;
				}
				case '*': {
					const char *value = [[self stringValue] UTF8String];
					[invocation setArgument:&value atIndex:index];
					break;
				}
				default: {
					NSLog(@"[ERROR] Don't know how to encode argument at index %lu with type %c", (unsigned long)index, ch);
					break;
				}
			}
		}
	}
}

@end

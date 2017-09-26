//
//  HyperloopValue.m
//  hyperloop
//
//  Created by Hans Knöchel on 18.07.17.
//  Copyright © 2017 Jeff Haynie. All rights reserved.
//

#import "HyperloopValue.h"
#import "define.h"

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

- (instancetype)initWithClass:(Class)className
{
  if (self = [super init]) {
    _object = nil;
    _clazz = className;
    _pointer = NO;
  }
  REMEMBER(self);
  return self;
}

- (instancetype)initWithSelector:(SEL)selector
{
  if (self = [super init]) {
    _object = nil;
    _clazz = nil;
    _selector = NSStringFromSelector(selector);
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

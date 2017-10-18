/**
 * Hyperloop Library
 * Copyright (c) 2015-Present by Appcelerator, Inc.
 */
#import "HyperloopClass.h"
#import "HyperloopPointer.h"
#import "HyperloopUtils.h"
#import "define.h"
#import <objc/message.h>
#import <objc/runtime.h>

@implementation HyperloopClass

@synthesize nativeObject = _nativeObject;

- (instancetype)initWithClassName:(NSString *)className alloc:(BOOL)alloc init:(SEL)init args:(NSArray *)args
{
  if (self = [self init]) {
    Class c = NSClassFromString(className);
    if (c == nil) {
      @throw [NSException exceptionWithName:@"ClassNotFound" reason:[NSString stringWithFormat:@"Cannot find class with name: %@", className] userInfo:nil];
    }
    id instance = nil;
    BOOL isInstance = YES;
    if (alloc) {
      instance = [c alloc];
    } else {
      instance = c;
      isInstance = NO;
    }

    id nativeObject = [HyperloopUtils invokeSelector:init args:args target:instance instance:isInstance];
    id target = [nativeObject objectValue];
    if (!target) {
      target = [nativeObject classValue];
    }
    self.nativeObject = target;
  }
  REMEMBER(self);
  return self;
}

- (void)dealloc
{
  [self destroy:nil];
  FORGET(self);
}

- (void)destroy:(id)args
{
  RELEASE_AND_CHECK(self.nativeObject);
  RELEASE_AND_CHECK(self.customClass);
}

- (id)target
{
  return self.nativeObject;
}

@end

/**
 * Hyperloop Library
 * Copyright (c) 2015-Present by Appcelerator, Inc.
 */

#import <Foundation/Foundation.h>
#import "define.h"

@interface HyperloopClass : BASECLASS

#ifndef TIMODULE
@property(nonatomic, retain) id nativeObject;
#endif
@property(nonatomic, retain) Class customClass;

/**
 * create a new instance using classname
 */
- (instancetype)initWithClassName:(NSString *)clsname alloc:(BOOL)alloc init:(SEL)init args:(NSArray *)args;

/**
 * return the right target object
 */
- (id)target;

@end

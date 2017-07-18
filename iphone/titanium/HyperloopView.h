/**
 * Hyperloop Module
 * Copyright (c) 2015-Present by Appcelerator, Inc.
 */
#ifdef TIMODULE

#import "TiUIView.h"

@interface HyperloopView : TiUIView

@property(nonatomic, retain) UIView *nativeView;
@property(nonatomic, retain) id nativeProxy;

- (instancetype)initWithView:(UIView *)view andProxy:(TiProxy *)proxy;

@end

#endif

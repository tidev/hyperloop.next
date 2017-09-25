/**
 * Hyperloop Module
 * Copyright (c) 2015-Present by Appcelerator, Inc.
 */
#ifdef TIMODULE

#import "TiUIView.h"

/**
 * The TiUIView subclass to hold the native view reference in.
 */
@interface HyperloopView : TiUIView

/**
 * The native view to be set from the view proxy.
 */
@property(nonatomic, retain) UIView *nativeView;

/**
 * The native proxy linked to this HyperloopView instance.
 */
@property(nonatomic, retain) id nativeProxy;

/**
 * Designated initializer to wrap a native view inside a given proxy
 *
 * @param view The native view to provide.
 * @param proxy The proxy to wrap the view in.
 * @return The new instance of the HyperloopView class.
 */
- (instancetype)initWithView:(UIView *)view andProxy:(TiProxy *)proxy;

@end

#endif

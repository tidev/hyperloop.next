/**
 * Hyperloop Module
 * Copyright (c) 2015-Present by Appcelerator, Inc.
 */
#ifdef TIMODULE

#import "HyperloopView.h"
#import "TiViewProxy.h"

/**
 * The view-proxy used to wrap native Hyperloop view instances.
 */
@interface HyperloopViewProxy : TiViewProxy

@property(nonatomic, retain) id nativeView;

@end

#endif

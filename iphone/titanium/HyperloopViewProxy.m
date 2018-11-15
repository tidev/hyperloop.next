/**
 * Hyperloop Module
 * Copyright (c) 2015-present by Appcelerator, Inc.
 */
#ifdef TIMODULE

#import "HyperloopViewProxy.h"
#import "class.h"

@implementation HyperloopViewProxy

-(void)setNativeView:(id)nativeView {
	if (_nativeView && [_nativeView respondsToSelector:@selector(destroy)]) {
		[_nativeView destroy];
		_nativeView = nil;
	}
	if (nativeView) {
		if ([nativeView isKindOfClass:[HyperloopClass class]]) {
			HyperloopClass *hyperloopClass = (HyperloopClass*)nativeView;
			id nativeObject = [hyperloopClass nativeObject];
			_nativeView = nativeObject;
		} else {
			_nativeView = nativeView;
		}
	} else {
		_nativeView = nil;
	}
}

-(void) dealloc {
	if (_nativeView && [_nativeView respondsToSelector:@selector(destroy)]) {
		[_nativeView destroy];
	}
	_nativeView = nil;
}

-(TiUIView*)newView {
	return [[HyperloopView alloc] initWithView:[self nativeView] andProxy:self];
}

-(UIViewAutoresizing)verifyAutoresizing:(UIViewAutoresizing)suggestedResizing {
	return suggestedResizing & ~(UIViewAutoresizingFlexibleHeight | UIViewAutoresizingFlexibleWidth);
}

-(NSString*)apiName {
	return @"HyperloopViewProxy";
}

-(TiDimension)defaultAutoWidthBehavior:(id)unused {
	return TiDimensionAutoFill;
}

-(TiDimension)defaultAutoHeightBehavior:(id)unused {
	return TiDimensionAutoFill;
}

@end

#endif

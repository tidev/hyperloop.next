/**
 * Hyperloop Module
 * Copyright (c) 2015-Present by Appcelerator, Inc.
 */
#ifdef TIMODULE

#import "HyperloopView.h"
#import "HyperloopModule.h"
#import "pointer.h"

TiObjectRef HyperloopGetWrapperForId(id obj);
TiContextRef HyperloopCurrentContext();

@implementation HyperloopView

- (instancetype)initWithView:(UIView *)view andProxy:(TiProxy *)_proxy
{
	if (self = [self init]) {
		self.nativeProxy = view;
		[self protectFromGC];
		UIView *target = view;
		self.nativeView = target;
		CGRect frame = [self.nativeView frame];
		[self setFrame:frame];
		[self setAutoresizingMask:UIViewAutoresizingFlexibleHeight | UIViewAutoresizingFlexibleWidth];
		if ([view isKindOfClass:[HyperloopPointer class]]) {
			[self addSubview:[(HyperloopPointer *)view nativeObject]];
		} else {
			[self addSubview:self.nativeView];
		}
		if (!CGRectIsEmpty(frame)) {
			[_proxy setValuesForKeysWithDictionary:@{
				@"width" : NUMFLOAT(frame.size.width),
				@"height" : NUMFLOAT(frame.size.height),
				@"left" : NUMFLOAT(frame.origin.x),
				@"top" : NUMFLOAT(frame.origin.y),
			}];
		}
		[self.nativeView addObserver:self forKeyPath:@"frame" options:0 context:NULL];
		[self.nativeView addObserver:self forKeyPath:@"bounds" options:0 context:NULL];
		[self.nativeView addObserver:self forKeyPath:@"center" options:0 context:NULL];
	}
	return self;
}

- (void)protectFromGC
{
	TiObjectRef wrapper = HyperloopGetWrapperForId(_nativeProxy);
	if (wrapper != NULL) {
		TiValueProtect(HyperloopCurrentContext(), wrapper);
	}
}

- (void)unprotectFromGC
{
	TiObjectRef wrapper = HyperloopGetWrapperForId(_nativeProxy);
	if (wrapper != NULL) {
		TiValueUnprotect(HyperloopCurrentContext(), wrapper);
	}
}

- (void)observeValueForKeyPath:(NSString *)keyPath ofObject:(id)object change:(NSDictionary *)change context:(void *)context
{
	dispatch_async(dispatch_get_main_queue(), ^{
	  if ([keyPath isEqualToString:@"bounds"] || [keyPath isEqualToString:@"frame"]) {
		  CGRect rect = self.nativeView.frame;
		  CGRect bounds = self.bounds;
		  if (!CGRectEqualToRect(rect, bounds)) {
			  TiProxy *proxy = [self proxy];
			  [proxy setValuesForKeysWithDictionary:@{ @"width" : NUMFLOAT(rect.size.width),
					                                   @"height" : NUMFLOAT(rect.size.height) }];
			  if ([keyPath isEqualToString:@"frame"]) {
				  [proxy setValuesForKeysWithDictionary:@{ @"left" : NUMFLOAT(rect.origin.x),
						                                   @"top" : NUMFLOAT(rect.origin.y) }];
			  }
		  }
	  } else if ([keyPath isEqualToString:@"center"]) {
		  CGPoint center = self.nativeView.center;
		  [[self proxy] setValue:@{ @"x" : NUMFLOAT(center.x),
				                    @"y" : NUMFLOAT(center.y) }
			              forKey:@"center"];
	  }
	});
}

- (void)frameSizeChanged:(CGRect)frame bounds:(CGRect)bounds
{
	[[self nativeView] setFrame:bounds];
	[super frameSizeChanged:frame bounds:bounds];
}

- (void)destroy
{
	if (self.nativeView) {
		[self.nativeView removeObserver:self forKeyPath:@"bounds"];
		[self.nativeView removeObserver:self forKeyPath:@"frame"];
		[self.nativeView removeObserver:self forKeyPath:@"center"];
		self.nativeView = nil;
	}
	self.nativeProxy = nil;
}

- (void)dealloc
{
	[self unprotectFromGC];
	[self destroy];
}

@end

#endif

/**
 * Appcelerator Titanium Mobile
 * Copyright (c) 2015 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

package hyperloop;

import org.appcelerator.titanium.TiDimension;
import org.appcelerator.titanium.proxy.TiViewProxy;
import org.appcelerator.titanium.view.TiCompositeLayout;
import org.appcelerator.titanium.view.TiUIView;

import android.view.View;
import android.view.ViewGroup.LayoutParams;
import android.widget.FrameLayout;

/**
 * Class used to interface between the Titanium.UI.View subclasses and native
 * android.view.View subclasses. When we want to add a native view to a
 * Ti.UI.View, we do so with this wrapper.
 *
 * @author cwilliams
 */
public class HyperloopView extends TiUIView {

    public HyperloopView(View nativeView, TiViewProxy proxy) {
        super(proxy);
        // Create a container for the native View
        FrameLayout comp = new FrameLayout(proxy.getActivity());

        TiCompositeLayout.LayoutParams params = getLayoutParams();
        // Tell Ti UI Composite layout to hold this content at the top left of
        // it's parent
        params.optionTop = new TiDimension(0, TiDimension.TYPE_TOP);
        params.optionLeft = new TiDimension(0, TiDimension.TYPE_LEFT);

        // Set to fill the parent by default
        params.autoFillsHeight = true;
        params.autoFillsWidth = true;

        // Make the wrapper around the native view expand to the size of the parent
        comp.setLayoutParams(
                new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT));
        // add the native view to our container
        comp.addView(nativeView);
        // Set this TiUIView's "native view" as our new container
        setNativeView(comp);
    }

}

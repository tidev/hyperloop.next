/**
 * Appcelerator Titanium Mobile
 * Copyright (c) 2015 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

package hyperloop;

import org.appcelerator.kroll.annotations.Kroll;

import com.android.dx.stock.ProxyBuilder;

/**
 * Represents a proxy that wraps a dynamically generated class (subclass of some
 * existing class). This will hold the dynamically generated Class, but will
 * report that it's of the extended type (via apiName property).
 *
 * @author cwilliams
 */
@Kroll.proxy(parentModule = HyperloopModule.class)
public class DynamicSubclassProxy extends ClassProxy {

    public DynamicSubclassProxy(Class<?> clazz, String className) {
        super(clazz, className);
    }

    @Override
    public InstanceProxy newInstance(Object[] initArgs) {
        InstanceProxy ip = super.newInstance(initArgs);
        if (ip == null) {
            return null;
        }
        ProxyBuilder.setInvocationHandler(ip.getWrappedObject(),
                new DynamicSubclassInvocationHandler(ip));
        return ip;
    }
}

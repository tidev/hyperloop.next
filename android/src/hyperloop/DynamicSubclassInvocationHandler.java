/**
 * Appcelerator Titanium Mobile
 * Copyright (c) 2015-2016 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

package hyperloop;

import java.lang.reflect.Method;

import com.android.dx.stock.ProxyBuilder;

/**
 * This forwards Java method calls to invoke the matching named method override
 * from the JS Object (here a HashMap<String, Object>). If there's no override
 * matching that method name, we call up to the super class.
 *
 * @author cwilliams
 */
class DynamicSubclassInvocationHandler extends HyperloopInvocationHandler {

    public DynamicSubclassInvocationHandler(InstanceProxy hyperloopProxy) {
        super(hyperloopProxy);
    }

    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        if (callSuper || !this.hp.getOverrides().containsKey(method.getName())) {
            // TODO What if superclass has marked the method as abstract?
            callSuper = false; // ok, reset it at the very first chance...
            return HyperloopUtil
                    .unwrap(ProxyBuilder.callSuper(this.hp.getWrappedObject(), method, args));
        }
        return super.invoke(proxy, method, args);
    }

}

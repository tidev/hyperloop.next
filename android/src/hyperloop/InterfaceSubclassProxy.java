/**
 * Appcelerator Titanium Mobile
 * Copyright (c) 2015 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

package hyperloop;

import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Proxy;
import java.util.Map;

import org.appcelerator.kroll.KrollDict;
import org.appcelerator.kroll.annotations.Kroll;
import org.appcelerator.kroll.common.Log;

/**
 * Represents a wrapper around a dynamic class that implements an interface.
 *
 * @author cwilliams
 */
@Kroll.proxy(parentModule = HyperloopModule.class)
public class InterfaceSubclassProxy extends DynamicSubclassProxy {

    public InterfaceSubclassProxy(Class<?> interfaceClass) {
        super(
                Proxy.getProxyClass(interfaceClass.getClassLoader(),
                        interfaceClass),
                interfaceClass.getName());
    }

    @SuppressWarnings("unchecked")
    @Kroll.method
    @Override
    public InstanceProxy newInstance(Object[] initArgs) {
        if (initArgs == null || initArgs.length != 1 || !(initArgs[0] instanceof Map)) {
            Log.e(TAG,
                    "Expected to receive a single JSObject holding key.value pairs holding method overrides for instance of "
                            + getApiName() + "'");
            return null;
        }
        // TODO Should we validate that there are overrides for each of the
        // methods listed on the interface?
        KrollDict dict;
        Map<String, Object> overrides = (Map<String, Object>) initArgs[0];
        if (overrides instanceof KrollDict) {
            dict = (KrollDict) overrides;
        } else {
            dict = new KrollDict(overrides);
        }
        try {
            Constructor<?> cons = this.clazz.getConstructor(InvocationHandler.class);
            HyperloopInvocationHandler hih = new HyperloopInvocationHandler();
            cons.setAccessible(true);
            Object instance = cons.newInstance(hih);
            // Generate an instance of this dynamic subclass, have it pretend to be of the interface's type, hold the native java instance.
            InstanceProxy proxy = new InstanceProxy(clazz, getApiName(), instance);
            proxy.setOverrides(dict);
            hih.setProxy(proxy);
            return proxy;
        } catch (Exception e) {
            Log.e(TAG, "Failed to instantiate instance of interface '"
                    + getApiName() + "'", e);
        }
        return null;
    }
}

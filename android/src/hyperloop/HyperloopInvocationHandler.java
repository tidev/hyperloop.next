/**
 * Appcelerator Titanium Mobile
 * Copyright (c) 2015 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

package hyperloop;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;

import org.appcelerator.kroll.KrollFunction;

/**
 * This is an invocation handler used to forward method calls from Java to the
 * JS overriding implementation. Used for anonymous instances of interfaces as
 * well as dynamic subclasses.
 *
 * @author cwilliams
 */
class HyperloopInvocationHandler implements InvocationHandler {

	private static final Method OBJECT_EQUALS = getObjectMethod("equals", Object.class);
	private static final Method OBJECT_HASHCODE = getObjectMethod("hashCode");
	private static final Method OBJECT_TOSTRING = getObjectMethod("toString");

    private static Method getObjectMethod(String name, Class... types) {
        try {
            // null 'types' is OK.
            return Object.class.getMethod(name, types);
        }
        catch (NoSuchMethodException e) {
            throw new IllegalArgumentException(e);
        }
    }

    protected InstanceProxy hp;

    protected HyperloopInvocationHandler(InstanceProxy hyperloopProxy) {
        this.hp = hyperloopProxy;
    }

    /**
     * This is bad design, but the way we must generate an instance of an
     * interface proxy requires we pass in an invocation handler to the
     * constructor, and we need the constructed object to generate an
     * InstanceProxy! Chicken and egg. So we solve it by making the design ugly
     * and calling setProxy later.
     */
    public HyperloopInvocationHandler() {
        this(null);
    }

    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        if (this.hp == null || this.hp.getOverrides() == null) {
            return null;
        }
        // TODO What if the method was marked final?
        Object value = hp.getOverrides().get(method.getName());
        if (value instanceof KrollFunction) {
            KrollFunction kf = (KrollFunction) value;
            return HyperloopUtil
                    .unwrap(kf.call(this.hp.getKrollObject(),
                            HyperloopUtil.wrapArguments(method.getParameterTypes(), args)));
        } else {
            if (OBJECT_EQUALS == method) {
                return doEquals(proxy, args[0]);
            } else if (OBJECT_HASHCODE == method) {
                return this.hashCode(); // Use the invocation handler's hash code in place of the dynamic proxy's
            } else if (OBJECT_TOSTRING == method) {
                return proxy.getClass().getName() + "@" + Integer.toHexString(this.hashCode());
            }
        }
        return null;
    }

    void setProxy(InstanceProxy proxy) {
        this.hp = proxy;
    }

    private boolean doEquals(Object self, Object other) {
        if (other == null) {
            return false;
        }
        InvocationHandler handler = Proxy.getInvocationHandler(other);
        if (!(handler instanceof HyperloopInvocationHandler)) {
            return false;
        }
        return ((HyperloopInvocationHandler) handler).hp == this.hp;
    }

}

/**
 * Appcelerator Titanium Mobile
 * Copyright (c) 2015 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

package hyperloop;

import java.lang.ref.WeakReference;
import java.util.WeakHashMap;

import org.appcelerator.kroll.common.Log;

import android.util.LruCache;

/**
 * This is a wrapper around generating instances of class or instance proxies.
 * This is used to hide caching details from the end-consumer. We attempt to
 * cache classes by name for faster lookups, and cache instance proxies by the
 * wrapped object so we always return/re-use the same proxy for the same Java
 * object.
 *
 * @author cwilliams
 */
public class ProxyFactory {

    private static final String TAG = "ProxyFactory";

    /**
     * Max number of classes whose proxy we'll cache in-memory. Not sure what a
     * good value is here.
     */
    private static final int CLASS_CACHE_SIZE = 25;

    /* FIXME It'd be good to hook up a ReferenceQueue in these WeakReference<InstanceProxy> 
     * so we know when the refs expire. I can't tell if UI related proxies like LayoutParams 
     * used on another proxy are getting properly cleaned up.
     */
    private WeakHashMap<Object, WeakReference<InstanceProxy>> fInstanceCache;
    private LruCache<String, ClassProxy> fClassCache;

    ProxyFactory() {
        Log.d(TAG, "Instantiating a ProxyFactory");
        fInstanceCache = new WeakHashMap<Object, WeakReference<InstanceProxy>>();
        fClassCache = new LruCache<String, ClassProxy>(CLASS_CACHE_SIZE);
    }

    public InstanceProxy newInstance(Object object) {
        return newInstance(object == null ? null : object.getClass(), object);
    }

    public InstanceProxy newInstance(Class<?> paramType, Object object) {
        if (object != null) {
            // check in the cache!
            if (fInstanceCache.containsKey(object)) {
                // TODO What if the proxy holds a different class type? We
                // likely need to "cast"
                WeakReference<InstanceProxy> ref = fInstanceCache.get(object);
                InstanceProxy proxy = ref.get();
                if (proxy != null) {
                    return proxy;
                }
            }
        }
        // Insert into cache!
        InstanceProxy proxy = new InstanceProxy(object.getClass(), paramType.getName(), object);
        fInstanceCache.put(object, new WeakReference<InstanceProxy>(proxy));
        return proxy;
    }

    public ClassProxy newClass(String className) {
        if (className == null || className.length() == 0) {
            return null;
        }
        ClassProxy cp = fClassCache.get(className);
        if (cp != null) {
            return cp;
        }
        // cache miss, let's look up the class in Java
        Class<?> clazz = HyperloopModule.getJavaClass(className);
        if (clazz == null) {
            return null; // TODO Cache null?!
        }
        // Generate our wrapping proxy, cache it by name
        cp = new ClassProxy(clazz);
        fClassCache.put(className, cp);
        return cp;
    }

    public void release(InstanceProxy instanceProxy) {
        fInstanceCache.remove(instanceProxy.getWrappedObject());
    }

}

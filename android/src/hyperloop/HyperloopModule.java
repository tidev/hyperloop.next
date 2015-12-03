/**
 * Appcelerator Titanium Mobile
 * Copyright (c) 2015 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

package hyperloop;

import java.io.IOException;
import java.lang.reflect.Modifier;
import java.util.Map;

import org.appcelerator.kroll.KrollDict;
import org.appcelerator.kroll.KrollModule;
import org.appcelerator.kroll.annotations.Kroll;
import org.appcelerator.kroll.common.Log;
import org.appcelerator.titanium.TiContext;

import com.android.dx.stock.ProxyBuilder;

import android.content.Context;

@Kroll.module(name="Hyperloop", id="hyperloop")
public class HyperloopModule extends KrollModule {

    private static final String TAG = "Ti.Hyperloop";
    // TODO Make this an instance field! need to clean up HyperloopUtil to be able to access it though...
    private static ProxyFactory fgProxyFactory = new ProxyFactory();

    public HyperloopModule() {
        super();
    }

    public HyperloopModule(TiContext tiContext) {
        this();
    }

    /**
     * Downcasts an InstanceProxy to a specific type. Checks that type by the
     * given name exists, object is an instance proxy, the cast is safe. If any
     * of those fail we log an error and return null.
     *
     * @param className
     * @param object
     * @return
     */
    @Kroll.method
    public InstanceProxy cast(String className, Object object) {
        if (!(object instanceof InstanceProxy)) {
            Log.e(TAG,
                    "Cannot cast anything but native hyperloop proxies around instances of objects!");
            return null;
        }
        Class<?> javaClass = HyperloopModule.getJavaClass(className);
        if (javaClass == null) {
            Log.e(TAG, "Cannot cast to class '" + className + "': class not found.");
            return null;
        }
        InstanceProxy ip = (InstanceProxy) object;
        return ip.cast(javaClass);
    }

    /**
     * Get a reference to a Java class. Shouldn't be used to generate
     * newInstances if it's an interface!
     *
     * @param className
     * @return
     */
    @Kroll.method
    public ClassProxy getClass(String className) {
        return getProxyFactory().newClass(className);
    }

    /**
     * This allows JS to get a reference to a dynamically generated class that
     * implements the supplied interface classname.
     *
     * @param className
     * @return
     */
    @Kroll.method
    public BaseProxy implement(String className) {
        if (className == null) {
            Log.e(TAG, "'class' value cannot be null.");
            return null;
        }
        Class<?> c = HyperloopModule.getJavaClass(className);
        if (c == null) {
            return null;
        }
        if (!c.isInterface()) {
            Log.e(TAG, "Cannot implement a class that isn't an interface!");
            return null;
        }
        return new InterfaceSubclassProxy(c);
    }

    /**
     * This allows JS to get a reference to a dynamically generated class that
     * extends the given base Java class.
     *
     * @param className
     * @return
     */
    @Kroll.method
    public BaseProxy extend(String className) {
        // This is the fully qualified name of the class we're extending
        if (className == null) {
            Log.e(TAG, "'class' value cannot be null.");
            return null;
        }

        // Load the class
        Class<?> c = HyperloopModule.getJavaClass(className);
        if (c == null) {
            return null;
        }
        int modifiers = c.getModifiers();

        // We can't extend final classes
        if (Modifier.isFinal(modifiers)) {
            Log.e(TAG, "Cannot extend class '" + className + "' with final modifier.");
            return null;
        }

        // We can't extend private/package protected classes
        if (!Modifier.isPublic(modifiers) && !Modifier.isProtected(modifiers)) {
            Log.e(TAG, "Cannot extend class '" + className
                    + "' with private or package-level visibility.");
            return null;
        }
        // TODO Allow extending an interface like this, even though we have
        // another entry point?

        // TODO Verify that overrides values are all KrollFunctions?
        // TODO Validate that we're not trying to override final methods?
        // TODO Validate we're not trying to override static methods?

        try {
            // Ok, now we generate a dynamic class that extends the class passed
            // in. We then wrap the class with a proxy.
            Class<?> generated = ProxyBuilder.forClass(c)
                    .dexCache(getActivity().getApplicationContext().getDir("dx",
                            Context.MODE_PRIVATE))
                    .buildProxyClass();

            return new DynamicSubclassProxy(generated, className);
        } catch (IOException e) {
            Log.e(TAG, "Failed to generate dynamic subclass of '" + className + "': "
                    + e.getMessage(), e);
        }
        return null;
    }

    @Override
    public String getApiName() {
        return "Hyperloop";
    }

    @SuppressWarnings("unchecked")
    static KrollDict argsToDict(Object[] args) {
        KrollDict dict;
        if (args[0] instanceof KrollDict) {
            dict = (KrollDict) args[0];
        } else {
            dict = new KrollDict((Map<? extends String, ? extends Object>) args[0]);
        }
        return dict;
    }

    public static ProxyFactory getProxyFactory() {
        return fgProxyFactory;
    }

    /**
     * Look up a class by name.
     *
     * @param className
     * @return
     */
    static Class<?> getJavaClass(String className) {
        // TODO Should we generate a cache for name to class (including nulls)?
        if (className == null) {
            Log.e(HyperloopUtil.TAG, "Missing 'class' value");
            return null;
        }

        try {
            Class<?> c = Class.forName(className);
            if (c == null) {
                Log.e(HyperloopUtil.TAG, "Class '" + className + "' not found");
                return null;
            }

            return c;
        } catch (ClassNotFoundException e) {
            Log.e(HyperloopUtil.TAG, "Class '" + className + "' not found", e);
        }
        return null;
    }
}

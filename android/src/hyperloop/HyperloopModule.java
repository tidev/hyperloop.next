/**
 * Appcelerator Titanium Mobile
 * Copyright (c) 2015 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

package hyperloop;

import java.io.IOException;
import java.lang.reflect.Modifier;

import org.appcelerator.kroll.KrollModule;
import org.appcelerator.kroll.annotations.Kroll;
import org.appcelerator.kroll.common.Log;
import org.appcelerator.titanium.TiApplication;
import org.appcelerator.titanium.util.TiUIHelper;
import hyperloop.HyperloopUtil;

import com.android.dx.stock.ProxyBuilder;

import android.content.Context;

@Kroll.module(name="Hyperloop", id="hyperloop")
public class HyperloopModule extends KrollModule {
    private static final char[] ALPHA = {'0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f'};

    private static final String TAG = "Ti.Hyperloop";
    // TODO Make this an instance field! need to clean up HyperloopUtil to be able to access it though...
    private static ProxyFactory fgProxyFactory = new ProxyFactory();

    // Assume we're ok until we can actually check...
    private volatile static boolean isPlatformGUID = true;

    /**
     * returns true if platform GUID, false if not (open source, legacy, invalid, etc)
     *
     * the platform guid is a special guid where it is a valid UUID v4 string but specifically
     * encoded in a certain way so that we can determine predicitably if it's a platform generated
     * GUID or one that wasn't generated with the platform.
     *
     * The GUID format is a generated random UUID v4 but where the following is changed:
     *
     * 9cba353d-81aa-4593-9111-2e83c0136c14
     *                      ^
     *                      +---- always 9
     *
     * 9cba353d-81aa-4593-9111-2e83c0136c14
     *                       ^^^
     *                       +---- the following 3 characters will be the same and will be
     *                             one of 0-9a-f
     *
     * 9cba353d-81aa-4593-9111-2e83c0136c14
     *                           ^
     *                           +----- the last remaining string is a SHA1 encoding of
     *                                  the org_id + app id (first 12 characters of the SHA1)
     *
     */
    private static boolean isPlatformGUID(String guid) {
        // UUID v4 is 36 characters long
        if (guid.length() == 36) {
            // example guid: 9cba353d-81aa-4593-9111-2e83c0136c14
            // for org_id 14301, appid : com.tii
            if (guid.charAt(19) == '9') {
                char alpha = guid.charAt(20);
                boolean found = false;
                for (int c = 0; c < ALPHA.length; c++) {
                    if (alpha == ALPHA[c]) {
                        found = true;
                        break;
                    }
                }
                if (found) {
                    String str = guid.substring(20, 23);
                    if (str.equals(Character.toString(alpha) + Character.toString(alpha) + Character.toString(alpha))) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    public HyperloopModule() {
        super();
    }

    @Kroll.onAppCreate
    public static void onAppCreate(TiApplication app) {
        // if not a valid platform GUID, we aren't going to enable Hyperloop
        if (!isPlatformGUID(app.getAppGUID())) {
            final String msg = "Hyperloop is not currently supported because this application has not been registered. To register this application with the Appcelerator Platform, run the command: appc new --import";
            Log.e(HyperloopUtil.TAG, msg);
            if (HyperloopUtil.isEmulator()) {
                TiUIHelper.doOkDialog("Alert", msg, null);
            }
            return;
        }
        isPlatformGUID = true;
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
        if (!isPlatformGUID) return null;
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
        if (!isPlatformGUID) return null;
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
        if (!isPlatformGUID) return null;
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
        if (!isPlatformGUID) return null;
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
        if (!isPlatformGUID) return null;
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

/**
 * Appcelerator Titanium Mobile
 * Copyright (c) 2015 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

package hyperloop;

import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.Arrays;

import org.appcelerator.kroll.KrollDict;
import org.appcelerator.kroll.annotations.Kroll;
import org.appcelerator.kroll.common.Log;
import org.appcelerator.titanium.TiApplication;
import org.appcelerator.titanium.proxy.TiViewProxy;
import org.appcelerator.titanium.view.TiUIView;

import android.app.Activity;

/**
 * This is the base class for all the various types of hyperloop proxies.
 * Subclasses handle dealing with whether we're wrapping a class, an instance of
 * a class, an interface, or a dynamic subclass.
 *
 * @author cwilliams
 */
@Kroll.proxy(parentModule = HyperloopModule.class)
public abstract class BaseProxy extends TiViewProxy {

    protected static final String TAG = "HyperloopProxy";

    protected Class<?> clazz;
    protected String className;

    protected BaseProxy(Class<?> clazz) {
        this(clazz, clazz.getName());
    }

    protected BaseProxy(Class<?> clazz, String className) {
        super();
        this.clazz = clazz;
        this.className = className;
    }

    /**
     * Get the item we're wrapping. This will be a class for proxies
     * representing a Java class. For an instance of a class, this will be the
     * object. For interfaces, this will be the java.lang.reflect.Proxy instance
     * that proxies calls for the interface. For dynamic subclass types, it will
     * be the generated class (generated at runtime by dexmaker). For instances
     * of dynamic subclasses, it will be the actual instance/object.
     *
     * @return
     */
    public abstract Object getWrappedObject();

    /**
     * The receiver to use for reflection calls. null for classes, the wrapped
     * object for instances.
     *
     * @return
     */
    public abstract Object getReceiver();

    @Kroll.method
    @Kroll.getProperty
    @Override
    public String getApiName() {
        return className;
    }

    @Kroll.getProperty
    public boolean getIsNativeProxy() {
        return true;
    }

    @Override
    public TiUIView createView(Activity activity) {
        // only instance proxy should override to generate a view for UI
        // elements
        return null;
    }

    @Kroll.method
    public Object callNativeFunction(Object[] args) {
        KrollDict dict = HyperloopModule.argsToDict(args);

        String methodname = dict.getString("func");
        if (methodname == null) {
            Log.e(TAG, "'func' cannot be null");
            return null;
        }

        Object[] functionArguments = (Object[]) dict.get("args");
        if (functionArguments == null) {
            functionArguments = new Object[0];
        }

        // assume instance methods. Flag really matters for proxies of classes
        // (no instance/alloc) where we're calling static methods!
        boolean isInstanceMethod = dict.optBoolean("instanceMethod", true);
        Object[] convertedArgs = HyperloopUtil.unwrapArguments(functionArguments);
        Method m = findMethod(methodname, convertedArgs, isInstanceMethod);
        if (m == null) {
            Log.e(TAG, "Unable to resolve method call. Class: " + getApiName() + ", method name: "
                    + methodname
                    + ", args: " + Arrays.toString(functionArguments));
            return null;
        }
        Object receiver = (isInstanceMethod ? getReceiver() : null);
        Object result = invokeMethod(m, receiver, convertedArgs);
        if (result == null) {
            return result;
        }
        // Force reported class to be the return type of the method!
        Class<?> returnType = m.getReturnType();
        return HyperloopUtil.wrap(returnType, result);
    }

    private Method findMethod(String methodName, Object[] convertedArgs,
            boolean instanceMethod) {
        return HyperloopUtil.resolveMethod(clazz, methodName, convertedArgs, instanceMethod);
    }

    private Object invokeMethod(Method m, Object receiver, Object[] convertedArgs) {
        m.setAccessible(true); // should offer perf boost since doesn't have to
                               // check security
        try {
            return m.invoke(receiver,
                    HyperloopUtil.convert(convertedArgs, m.getParameterTypes(), m.isVarArgs()));
        } catch (IllegalAccessException e) {
            Log.e(TAG, "Unable to access method: " + m.toString(), e);
        } catch (IllegalArgumentException e) {
            Log.e(TAG, "Bad argument for method: " + m.toString() + ", args: "
                    + Arrays.toString(convertedArgs), e);
        } catch (InvocationTargetException e) {
            Log.e(TAG, "Exception thrown during invocation of method: " + m.toString()
                    + ", args: "
                    + Arrays.toString(convertedArgs),
                    e.getCause());
        }
        return null;
    }

    @Kroll.method
    public Object getNativeField(String fieldName) {
        Field f = getField(fieldName);
        if (f == null) {
            return null;
        }

        try {
            Object result = f.get(getReceiver());
            return HyperloopUtil.wrap(f.getType(), result);
        } catch (IllegalAccessException e) {
            Log.e(TAG, "Unable to access field: " + f.toString(), e);
        } catch (IllegalArgumentException e) {
            Log.e(TAG, "Receiving object is not an instance of the declaring type for field: "
                    + f.toString(), e);
        }
        return null;
    }

    @Kroll.method
    public void setNativeField(String fieldName, Object newValue) {
        Field f = getField(fieldName);
        if (f == null) {
            return;
        }

        newValue = HyperloopUtil.unwrap(newValue);
        newValue = HyperloopUtil.convertTo(newValue, f.getType());
        try {
            f.setAccessible(true); // should offer perf boost since doesn't have
                                   // to check security
            f.set(getReceiver(), newValue);
        } catch (IllegalAccessException e) {
            Log.e(TAG, "Unable to access field: " + f.toString(), e);
        } catch (IllegalArgumentException e) {
            Log.e(TAG,
                    "Receiving object not an instance of declaring type, or failed to box/unbox primitive for field: "
                            + f.toString(),
                    e);
        }
    }

    private Field getField(String fieldName) {
        if (fieldName == null) {
            Log.e(TAG, "'field' cannot be null");
            return null;
        }

        // Access the field
        try {
            return clazz.getField(fieldName);
        } catch (NoSuchFieldException e) {
            Log.e(TAG, "No such field: Class: " + getApiName() + ", field name: "
                    + fieldName, e);
            return null;
        }
    }

    @Override
    public Activity getActivity() {
        Activity activity = super.getActivity();
        // try to avoid ever having a null activity
        if (activity == null) {
            return TiApplication.getAppCurrentActivity();
        }
        return activity;
    }
}

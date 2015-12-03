/**
 * Appcelerator Titanium Mobile
 * Copyright (c) 2015 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

package hyperloop;

import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;
import java.util.Arrays;
import java.util.Map;

import org.appcelerator.kroll.KrollProxy;
import org.appcelerator.kroll.annotations.Kroll;
import org.appcelerator.kroll.common.Log;

/**
 * Represents a proxy that wraps a class.
 *
 * @author cwilliams
 */
@Kroll.proxy(parentModule = HyperloopModule.class)
public class ClassProxy extends BaseProxy {

    public ClassProxy(Class<?> clazz) {
        super(clazz);
    }

    protected ClassProxy(Class<?> clazz, String className) {
        super(clazz, className);
    }

    @Override
    public Object getWrappedObject() {
        return this.clazz;
    }

    @Override
    public Object getReceiver() {
        // use null for reflection
        return null;
    }

    @Kroll.getProperty
    public boolean getIsClassProxy() {
        return true;
    }

    @SuppressWarnings("unchecked")
    @Kroll.method
    public InstanceProxy newInstance(Object[] initArgs) {
        if (initArgs == null) {
            initArgs = new Object[0];
        } else {
            // Handle converting JS arguments object from HashMap to Object[]
            if (initArgs != null && initArgs.length == 1 && initArgs[0] instanceof Map) {
                initArgs = convertArgumentsMapToArray((Map<Integer, Object>) initArgs[0]);
            }
        }

        try {
            Object[] convertedArgs = HyperloopUtil.unwrapArguments(initArgs);
            // If we get a single Titanium proxy, that's not a dynamic
            // hyperloop one (think ActivityProxy, or ButtonProxy)
            // Let's re-wrap the native object with a hyperloop proxy
            if (convertedArgs.length == 1 && convertedArgs[0] != null
                    && clazz.isAssignableFrom(convertedArgs[0].getClass())
                    && initArgs[0] instanceof KrollProxy
                    && !(initArgs[0] instanceof BaseProxy)) {
                // Wrap the Titanium proxy as a hyperloop proxy of an
                // instance
                return ((HyperloopModule) getCreatedInModule()).getProxyFactory()
                        .newInstance(convertedArgs[0]);
            }

            // Use reflection to generate an instance of the class
            // based on the args
            Constructor<?> cons = HyperloopUtil.resolveConstructor(clazz, convertedArgs);
            if (cons == null) {
                Log.e(TAG,
                        "Unable to find matching constructor for class: " + className
                                + ", args: " + Arrays.toString(convertedArgs));
                return null;
            }

            // generate an instance of the object
            Object instance = cons.newInstance(
                    HyperloopUtil.convert(convertedArgs, cons.getParameterTypes(),
                            cons.isVarArgs()));
            if (instance == null) {
                Log.e(TAG, "Object " + className + " could not be created");
                return null;
            }

            return ((HyperloopModule) getCreatedInModule()).getProxyFactory().newInstance(clazz,
                    instance);
        } catch (InstantiationException e) {
            Log.e(TAG, "Unable to instantiate class '" + className + "'", e);
        } catch (IllegalAccessException e) {
            Log.e(TAG, "Unable to access class '" + className + "'", e);
        } catch (IllegalArgumentException e) {
            Log.e(TAG, "Illegal arguments to instantiate class '" + className + "'", e);
        } catch (InvocationTargetException e) {
            Log.e(TAG, "Exception during instantiation of class '" + className + "'", e.getCause());
        }
        return null;
    }

    /**
     * When we receive a JS arguments object, it comes in as a Map<Integer,
     * Object>. This converts that to an Object[]. If no entry exists for an
     * index, we place null in the array.
     *
     * @param object
     * @return
     */
    private Object[] convertArgumentsMapToArray(Map<Integer, Object> arguments) {
        if (arguments == null || arguments.size() == 0) {
            return new Object[0];
        }
        // find the highest index
        int highest = 0;
        for (Integer current : arguments.keySet()) {
            highest = Math.max(highest, current);
        }
        // create an array to hold proper amount of elements
        Object[] array = new Object[highest + 1];
        for (Map.Entry<Integer, Object> entry : arguments.entrySet()) {
            array[entry.getKey()] = entry.getValue();
        }
        return array;
    }
}

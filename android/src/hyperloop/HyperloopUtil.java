/**
 * Appcelerator Titanium Mobile
 * Copyright (c) 2015 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

package hyperloop;

import java.lang.reflect.Array;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;

import org.appcelerator.kroll.KrollProxy;
import org.appcelerator.titanium.proxy.ActivityProxy;
import org.appcelerator.titanium.proxy.TiViewProxy;

abstract class HyperloopUtil {
    // TODO This is a hack. We should move all this stuff into the BaseProxy or
    // something...

    static final String TAG = "HyperloopUtil";

    // Don't allow creating an instance
    private HyperloopUtil() {
    }

    /**
     * Wrap native objects with hyperloop proxies.
     *
     * @param args
     * @return
     */
    static Object[] wrapArguments(Class<?>[] params, Object[] args) {
        final int argCount = (args == null) ? 0 : args.length;
        if (argCount == 0) {
            // We cannot pass along a null reference for argument array to
            // native V8Function, or it will crash!
            // return empty array
            return new Object[0];
        }
        if (argCount > params.length) {
            // VARARGS!
        }
        Object[] wrapped = new Object[argCount];
        for (int i = 0; i < argCount; i++) {
            // FIXME Handle varargs! We need to make sure we only go to second
            // last param then, and ensure all remaining args
            // are of the component type of the last param
            wrapped[i] = wrap(params[i], args[i]);
        }
        return wrapped;
    }

    /**
     * Wraps a return value in a proxy if necessary. if it's already a proxy or
     * primitive, the framework will convert to JS for us.
     *
     * @param result
     * @return
     */
    static Object wrap(Class<?> paramType, Object result) {
        return isKnownType(result) ? result
                : HyperloopModule.getProxyFactory().newInstance(paramType, result);
    }

    /**
     * Is this item a type that the JS engine can handle/convert on it's own? if
     * so, we don't need to worry about converting it by wrapping with a proxy.
     * Also we've whitelisted that it's ok to return.
     *
     * @param item
     * @return
     */
    private static boolean isKnownType(Object item) {
        // FIXME Look at TypeConverter to see all the ones we really handle
        return item == null || item instanceof KrollProxy || item instanceof Integer
                || item instanceof Double || item instanceof Float
                || item instanceof Byte || item instanceof Short
                || item instanceof Long || item instanceof HashMap
                || item instanceof String || item instanceof Boolean || item instanceof Date;
    }

    /**
     * Convert the "raw" args we received to unwrap proxies down to the object
     * they hold.
     *
     * @param arguments
     * @return
     */
    static Object[] unwrapArguments(Object[] arguments) {
        final int argCount = (arguments == null) ? 0 : arguments.length;
        Object[] unwrapped = new Object[argCount];
        for (int i = 0; i < argCount; i++) {
            unwrapped[i] = unwrap(arguments[i]);
        }
        return unwrapped;
    }

    /**
     * If the argument is a proxy, unwrapp the native object it holds.
     *
     * @param object
     * @return
     */
    static Object unwrap(Object object) {
        if (object == null) {
            return null;
        }

        // Native code handles unwrapping JS proxy to the underlying Java
        // BaseProxy
        // see
        // https://github.com/appcelerator/titanium_mobile/blob/master/android/runtime/v8/src/native/TypeConverter.cpp#L628

        // If it's a proxy, unwrap the native object we're wrapping
        if (object instanceof BaseProxy) {
            return ((BaseProxy) object).getWrappedObject();
        }

        // Convert some of the titanium wrappers
        if (object instanceof ActivityProxy) {
            ActivityProxy ap = (ActivityProxy) object;
            return ap.getActivity();
        }
        // Convert Ti.UI.View subclasses
        if (object instanceof TiViewProxy) {
            TiViewProxy tvp = (TiViewProxy) object;
            return tvp.getOrCreateView().getNativeView();
        }
        // TODO Convert more Titanium types!
        return object;
    }

    /**
     * Converts the raw Object[] we receive for a method call into the required
     * types that the method takes, and handles varargs. See
     * {@link #convertTo(Object, Class)}
     *
     * @param arguments
     * @param parameterTypes
     * @param isVarArgs
     * @return
     */
    static Object[] convert(Object[] arguments, Class<?>[] parameterTypes,
            boolean isVarArgs) {
        if (arguments == null) {
            return null;
        }
        int paramCount = parameterTypes.length;
        if (paramCount == 0) {
            return new Object[0];
        }

        int end = paramCount;
        if (isVarArgs) {
            end = paramCount - 1;
        }
        Object[] result = new Object[paramCount];
        for (int i = 0; i < end; i++) {
            result[i] = convertTo(arguments[i], parameterTypes[i]);
        }
        if (isVarArgs) {
            // Generate an array of the given type from all the remaining
            // arguments
            int argCount = arguments.length;
            int size = argCount - end;
            Class<?> componentType = parameterTypes[end].getComponentType();
            Object varargs = Array.newInstance(componentType, size);
            for (int x = end; x < argCount; x++) {
                Array.set(varargs, x - end, convertTo(arguments[x], componentType));
            }
            result[end] = varargs;
        }
        return result;
    }

    /**
     * This is effectively to fix downcasting for primitives. We always get
     * doubles from JS Number, so we need to handle allowing more broad input
     * number types and "casting" them to the field/param type required.
     *
     * @param newValue
     * @param target
     * @return
     */
    static Object convertTo(Object newValue, Class<?> target) {
        if (target.isPrimitive()) {
            // uh oh!
            if (newValue == null) {
                return null;
            }
            if (newValue instanceof Number) {
                Number num = (Number) newValue;
                if (byte.class.equals(target)) {
                    return num.byteValue();
                } else if (int.class.equals(target)) {
                    return num.intValue();
                } else if (double.class.equals(target)) {
                    return num.doubleValue();
                } else if (float.class.equals(target)) {
                    return num.floatValue();
                } else if (short.class.equals(target)) {
                    return num.shortValue();
                } else if (long.class.equals(target)) {
                    return num.longValue();
                }
            }
            // Probably a big no-no...
            return newValue;
        }
        // Not a primitive... So, just hope it's the right type?
        return newValue;
    }

    /**
     * Given a class, method name and some arguments - can we find the intended
     * target method to call?
     *
     * @param c
     * @param name
     * @param arguments
     * @param instanceMethod
     * @return
     */
    static Method resolveMethod(Class<?> c, String name, Object[] arguments,
            boolean instanceMethod) {
        int argCount = (arguments == null) ? 0 : arguments.length;
        // if no args, assume we want a no-arg constructor!
        if (argCount == 0) {
            try {
                return c.getMethod(name);
            } catch (NoSuchMethodException e) {
                // may be no method with this name and no args (bad method name,
                // or maybe takes varargs)
            }
        }

        // TODO Is there a more performant way to search methods? This can
        // result in a lot of methods for some types
        Method[] methods = c.getMethods();
        // TODO Filter by instance/static first?
        if (methods.length == 1) {
            return methods[0];
        }

        List<Match<Method>> matches = new ArrayList<Match<Method>>();
        for (Method method : methods) {
            if (!method.getName().equals(name)) {
                continue;
            }
            Class<?>[] params = method.getParameterTypes();
            boolean isVarArgs = method.isVarArgs();
            Match<Method> match = null;
            if (isVarArgs) {
                if (argCount >= (params.length - 1)) {
                    match = createMatch(method, params, arguments, isVarArgs);
                }
            } else if (params.length == argCount) {
                match = createMatch(method, params, arguments, isVarArgs);
            }
            if (match != null) {
                // Shortcut if the distance is 0: That's an exact match...
                if (match.isExact()) {
                    return match.method;
                }
                matches.add(match);
            }
        }
        if (matches.isEmpty()) {
            // Log something?
            return null;
        }
        // Sort matches by distance (lowest wins)
        Collections.sort(matches);
        return matches.get(0).method;
    }

    /**
     * Given an argument array and a class we want to instantiate, resolve the
     * best matching constructor.
     *
     * @param c
     * @param arguments
     * @return
     */
    static Constructor resolveConstructor(Class<?> c, Object[] arguments) {
        int argCount = (arguments == null) ? 0 : arguments.length;
        // if no args, assume we want a no-arg constructor!
        if (argCount == 0) {
            try {
                return c.getConstructor();
            } catch (NoSuchMethodException e) {
                // TODO may be no no-arg constructor!
                e.printStackTrace();
            }
        }

        Constructor<?>[] constructors = c.getConstructors();
        if (constructors.length == 1) {
            return constructors[0];
        }

        List<Match<Constructor>> matches = new ArrayList<Match<Constructor>>();
        for (Constructor constructor : constructors) {
            Class<?>[] params = constructor.getParameterTypes();
            boolean isVarArgs = constructor.isVarArgs();
            Match<Constructor> match = null;
            if (isVarArgs) {
                if (argCount >= (params.length - 1)) {
                    match = createMatch(constructor, params, arguments, isVarArgs);
                }
            } else if (params.length == argCount) {
                match = createMatch(constructor, params, arguments, isVarArgs);
            }
            if (match != null) {
                // Shortcut if the distance is 0: That's an exact match...
                if (match.isExact()) {
                    return match.method;
                }
                matches.add(match);
            }
        }
        if (matches.isEmpty()) {
            // Log something?
            return null;
        }
        // Sort matches by distance (lowest wins)
        Collections.sort(matches);
        return matches.get(0).method;
    }

    /**
     * Determines if the method is a match. If not, this will return null. If it
     * is, returns a Match object holding the method and the distance of the
     * match.
     *
     * @param m
     * @param params
     * @param arguments
     * @return
     */
    private static <T> Match<T> createMatch(T m, Class<?>[] params, Object[] arguments,
            boolean isVarArgs) {
        int distance = Match.EXACT; // start as exact, increasing as we get
                                    // further
        // match all arguments normally
        int end = params.length;
        // for varargs match to last param type normally.
        if (isVarArgs) {
            end = params.length - 1;
        }

        // make sure a given arg matches
        for (int i = 0; i < end; i++) {
            int argDistance = matchArg(params[i], arguments[i]);
            if (argDistance >= 0) {
                distance += argDistance;
            } else {
                // can't convert, no match
                return null;
            }
        }

        if (isVarArgs) {
            // Need to do special matching for last param
            int start = params.length - 1;
            Class<?> lastParam = params[start];
            Class<?> componentType = lastParam.getComponentType();
            // Now match that all the rest of the args can be of this type!
            for (int i = start; i < arguments.length; i++) {
                int argDistance = matchArg(componentType, arguments[i]);
                if (argDistance >= 0) {
                    distance += argDistance;
                } else {
                    // can't convert, no match
                    return null;
                }
            }
        }

        return new Match<T>(m, distance);
    }

    private static int matchArg(Class<?> param, Object arg) {
        if (arg == null) {
            // can't have a null primitive arg, no match
            if (param.isPrimitive()) {
                return -1;
            }
            // if null arg for a non-primitive, assume no distance change
            return 0;
        }
        // typical case
        return distance(param, arg.getClass());
    }

    /**
     * Determine the distance between the argument types and the intended
     * parameter types. Returns -1 if no match.
     *
     * @param target
     * @param argument
     * @return
     */
    private static int distance(Class<?> target, Class<?> argument) {
        // Primitives - we always have a boxed type for our argument
        if (target.isPrimitive()) {
            // https://docs.oracle.com/javase/specs/jls/se7/html/jls-5.html#jls-5.3
            // Says we can do primitive widening, as per:
            // http://docs.oracle.com/javase/specs/jls/se7/html/jls-5.html#jls-5.1.2
            // Widening

            // We need to support more liberal conversion
            // i.e. textView#setTextView(0, 60); should be ok (setTextView param
            // types are (int, float))
            // TODO Avoid matching byte if the arg is a number type that woudl
            // overflow?
            // Or at least increase distance?
            if (byte.class.equals(target)) {
                if (Byte.class.equals(argument)) { // signed 8-bit
                    return Match.EXACT;
                }
                if (Short.class.equals(argument)) { // signed 16-bit
                    return 1;
                }
                if (Integer.class.equals(argument)) {
                    return 2;
                }
                if (Long.class.equals(argument)) {
                    return 3;
                }
                if (Float.class.equals(argument)) {
                    return 4;
                }
                if (Double.class.equals(argument)) {
                    return 5;
                }
            }
            if (short.class.equals(target)) {
                if (Byte.class.equals(argument)) {
                    return 1;
                }
                if (Short.class.equals(argument)) { // signed 16-bit
                    return Match.EXACT;
                }
                if (Integer.class.equals(argument)) {
                    return 1;
                }
                if (Long.class.equals(argument)) {
                    return 2;
                }
                if (Float.class.equals(argument)) {
                    return 3;
                }
                if (Double.class.equals(argument)) {
                    return 4;
                }
            }
            if (int.class.equals(target)) {
                if (Byte.class.equals(argument)) {
                    return 2;
                }
                if (Short.class.equals(argument)) {
                    return 1;
                }
                if (Integer.class.equals(argument)) {
                    return Match.EXACT;
                }
                if (Long.class.equals(argument)) {
                    return 1;
                }
                if (Float.class.equals(argument)) {
                    return 2;
                }
                if (Double.class.equals(argument)) {
                    return 3;
                }
            }
            if (long.class.equals(target)) {
                if (Byte.class.equals(argument)) {
                    return 3;
                }
                if (Short.class.equals(argument)) {
                    return 2;
                }
                if (Integer.class.equals(argument)) {
                    return 1;
                }
                if (Long.class.equals(argument)) {
                    return Match.EXACT;
                }
                if (Float.class.equals(argument)) {
                    return 1;
                }
                if (Double.class.equals(argument)) {
                    return 2;
                }
            }
            if (float.class.equals(target)) {
                if (Byte.class.equals(argument)) {
                    return 4;
                }
                if (Short.class.equals(argument)) {
                    return 3;
                }
                if (Integer.class.equals(argument)) {
                    return 2;
                }
                if (Long.class.equals(argument)) {
                    return 1;
                }
                if (Float.class.equals(argument)) {
                    return Match.EXACT;
                }
                if (Double.class.equals(argument)) {
                    return 1;
                }
            }
            if (double.class.equals(target)) {
                if (Byte.class.equals(argument)) {
                    return 5;
                }
                if (Short.class.equals(argument)) {
                    return 4;
                }
                if (Integer.class.equals(argument)) {
                    return 3;
                }
                if (Long.class.equals(argument)) {
                    return 2;
                }
                if (Float.class.equals(argument)) {
                    return 1;
                }
                if (Double.class.equals(argument)) {
                    return Match.EXACT;
                }
            }
            if (boolean.class.equals(target) && Boolean.class.equals(argument)) {
                return Match.EXACT;
            }
            return Match.NO_MATCH;
        }

        // Non-primitives
        if (!target.isAssignableFrom(argument)) {
            return Match.NO_MATCH;
        }

        // How far are the two types in the type hierarchy?
        return 100 * hops(argument, target, 0);
    }

    /**
     * Try to use recursion to determine how many types away in the type
     * hierarchy the target type is.
     *
     * @param src
     * @param target
     * @param hops
     * @return
     */
    private static int hops(Class<?> src, Class<?> target, int hops) {
        // FIXME This is pretty slow and can result in some deep recursion in
        // some cases...
        // Can we do better?
        // If we know the target is an interface, is there a point in searching
        // super classes (other than looking at it's interfaces?)
        if (src == null) {
            return -1; // end of recursion, no parent type!
        }

        // they're the same class, no hops up the hierarchy
        if (target.equals(src)) {
            return hops;
        }

        // Take the least hops of traversing the parent type...
        int result = hops(src.getSuperclass(), target, hops + 1);

        // or the interfaces...
        Class<?>[] interfaces = src.getInterfaces();
        if (interfaces != null && interfaces.length > 0) {
            for (int i = 0; i < interfaces.length; i++) {
                int interfaceHops = hops(interfaces[i], target, hops + 1);
                if (interfaceHops > -1 && (result == -1 || interfaceHops < result)) {
                    // match up the interface hierarchy
                    result = interfaceHops;
                }
            }
        }
        return result;
    }

    /**
     * Represents a Method match. Holds the method that matched along with an
     * integer representing how close or distant the match is. Lower distance ==
     * better match.
     *
     * @author cwilliams
     */
    private static class Match<T> implements Comparable<Match<T>> {

        public static final int NO_MATCH = -1;
        public static final int EXACT = 0;

        public int distance;
        public T method;

        Match(T m, int dist) {
            this.distance = dist;
            this.method = m;
        }

        public boolean isExact() {
            return distance == EXACT;
        }

        @Override
        public int compareTo(Match<T> another) {
            return distance - another.distance;
        }

        @Override
        public String toString() {
            return method.toString() + ", distance: " + distance;
        }
    }
}

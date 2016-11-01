using System;
using System.Reflection;
using System.Runtime.InteropServices.WindowsRuntime;
using System.Collections.Generic;

namespace HyperloopInvocation
{
    /*
     * Encapsulate native object because some types can't get through WinRT boundary
     */
    public sealed class Instance
    {
        public object NativeObject { get; set; }
        public Type   NativeType   { get; set; }

        public Instance(Type t, object o)
        {
            NativeType   = t;
            NativeObject = o;
        }
        public bool IsString()
        {
            return NativeType == typeof(System.String);
        }
        public bool IsBoolean()
        {
            return NativeType == typeof(System.Boolean);
        }
        public bool IsNumber()
        {
            return (NativeType == typeof(System.Double) ||
                NativeType == typeof(System.Single) ||
                NativeType == typeof(System.Decimal) ||
                NativeType == typeof(System.Int64) ||
                NativeType == typeof(System.Int32) ||
                NativeType == typeof(System.Int16) ||
                NativeType == typeof(System.UInt64) ||
                NativeType == typeof(System.UInt32) ||
                NativeType == typeof(System.UInt16) ||
                NativeType == typeof(System.SByte) ||
                NativeType == typeof(System.Byte));
        }
        public static object Convert(Type nativeType, double number)
        {
            return System.Convert.ChangeType(number, nativeType);
        }

        /*
         * Converts the value of the specified object to the equivalent double-precision floating-point number.
         */
        public double ConvertToNumber()
        {
            return System.Convert.ToDouble(NativeObject);
        }

        public static Type[] GetConstructorParameters(Type nativeType, int expectedCount)
        {
#if UWP_PORTABLE
            /*
             * UWP 8.1 Portable doesn't support GetConstructors
             */
            return new Type[0];
#else
            ConstructorInfo[] ctors = nativeType.GetConstructors();
            foreach(ConstructorInfo ctor in ctors)
            {
                ParameterInfo[] parameters = ctor.GetParameters();
                if (parameters.Length == expectedCount)
                {
                    Type[] types = new Type[expectedCount];
                    for (int i = 0; i < parameters.Length; i++)
                    {
                        types[i] = parameters[i].GetType();
                    }
                    return types;
                }
            }
            return new Type[0];
#endif
        }
        public static Instance New(Type nativeType, [ReadOnlyArray()] Instance[] arguments)
        {
            // default constructor
            if (arguments == null)
            {
                return new Instance(nativeType, Activator.CreateInstance(nativeType));
            }

            object[] args = new object[arguments.Length];
            for (int i = 0; i < arguments.Length; i++)
            {
                args[i] = arguments[i].NativeObject;
            }

            return new Instance(nativeType, Activator.CreateInstance(nativeType, args));
        }
    }

    /*
     * Encapsulate MethodInfo because it can't get through WinRT boundary
     */
    public sealed class Method
    {
        public string Name { get; set; }
        private MethodInfo methodInfo;
        public Method(string name)
        {
            Name = name;
        }
        public Instance Invoke(Instance instance, [ReadOnlyArray()] Instance[] arguments)
        {
            object instanceObj = null;
            if (instance != null)
            {
                instanceObj = instance.NativeObject;
            }
            if (arguments == null)
            {
                object obj = methodInfo.Invoke(instanceObj, null);
                return new HyperloopInvocation.Instance(obj.GetType(), obj);
            }
            else
            {
                object[] args = new object[arguments.Length];
                for (int i = 0; i < arguments.Length; i++)
                {
                    args[i] = arguments[i].NativeObject;
                }
                object obj = methodInfo.Invoke(instanceObj, args);
                return new HyperloopInvocation.Instance(obj.GetType(), obj);
            }
        }
        public Type[] GetParameters()
        {
            ParameterInfo[] parameters = methodInfo.GetParameters();
            Type[] types = new Type[parameters.Length];
            for(int i = 0; i < parameters.Length; i++)
            {
                types[i] = parameters[i].ParameterType;
            }
            return types;
        }
        public static Method GetMethod(Type type, string name, [ReadOnlyArray()] Type[] parameters)
        {
            MethodInfo methodInfo = type.GetRuntimeMethod(name, parameters == null ? new Type[0] : parameters);
            if (methodInfo == null)
            {
                return null;
            }
            Method method = new Method(name);
            method.methodInfo = methodInfo;
            return method;
        }
        public static IList<Method> GetMethods(Type type, string name, int expectedCount)
        {
            // TODO: Cache
            IList<Method> methodList = new List<Method>();
            var methods = type.GetRuntimeMethods();
            foreach (MethodInfo methodInfo in methods)
            {
                if (methodInfo.Name == name && methodInfo.GetParameters().Length == expectedCount)
                {
                    Method method = new Method(name);
                    method.methodInfo = methodInfo;
                    methodList.Add(method);
                }
            }
            return methodList;
        }
        public static bool HasMethod(Type type, string name)
        {
            // TODO: Cache
            var methods = type.GetRuntimeMethods();
            foreach (MethodInfo methodInfo in methods)
            {
                if (methodInfo.Name == name)
                {
                    return true;
                }
            }
            return false;
        }
    }

    /*
     * Encapsulate PropertyInfo because it can't get through WinRT boundary
    */
    public sealed class Property
    {
        public string Name { get; set; }
        private PropertyInfo propertyInfo;
        public Property(string name)
        {
            Name = name;
        }
        public Instance GetValue(Instance instance)
        {
            object obj = null;
            if (instance != null)
            {
                obj = instance.NativeObject;
            }
            object value = propertyInfo.GetValue(obj);
            return new Instance(propertyInfo.PropertyType, value);
        }
        public void SetValue(Instance instance, object value)
        {
            propertyInfo.SetValue(instance.NativeObject, value);
        }

        public static Property GetProperty(Type type, string name)
        {
            PropertyInfo propertyInfo = type.GetRuntimeProperty(name);
            if (propertyInfo != null)
            {
                Property property = new Property(name);
                property.propertyInfo = propertyInfo;
                return property;
            }
            return null;
        }
        public static bool HasProperty(Type type, string name)
        {
            return GetProperty(type, name) != null;
        }
    }
}

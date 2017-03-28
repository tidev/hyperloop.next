using System;
using System.Reflection;
using System.Runtime.InteropServices.WindowsRuntime;
using System.Collections.Generic;
using Windows.Foundation;

namespace HyperloopInvocation
{
    public sealed class AsyncEvent
    {
        public event TypedEventHandler<object, AsyncStatus> Completed;
        public void OnCompleted(object sender, AsyncStatus args)
        {
            Completed?.Invoke(sender, args);
        }

    }

    public sealed class AsyncSupport
    {
        public static bool IsAsyncAction(Type t)
        {
            return t == typeof(IAsyncAction);
        }
        public static bool IsAsyncActionWithProgress(Type t)
        {
            return t.GetGenericTypeDefinition() == typeof(IAsyncActionWithProgress<>);
        }
        public static bool IsAsyncOperation(Type t)
        {
            return t.GetGenericTypeDefinition() == typeof(IAsyncOperation<>);
        }
        public static bool IsAsyncOperationWithProgress(Type t)
        {
            return t.GetGenericTypeDefinition() == typeof(IAsyncOperationWithProgress<,>);
        }

        public static void AddCompletedHandler(Type t, object asyncOperation, AsyncEvent handler)
        {
            PropertyInfo completed = t.GetRuntimeProperty("Completed");
            Type[] completedArgs = { typeof(object), typeof(AsyncStatus) };
            MethodInfo onCompleted = typeof(AsyncEvent).GetRuntimeMethod("OnCompleted", completedArgs);

            Delegate d = onCompleted.CreateDelegate(completed.PropertyType, handler);
            completed.SetValue(asyncOperation, d);
        }

        // Get results from IAsyncOperation and IAsyncOperationWithProgress
        public static object GetResults(Type t, object obj)
        { 
            Method method = Method.GetMethod(t, "GetResults", new Type[0]);
            return method.Invoke(obj);
        }
    }

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
        public bool IsAsync()
        {
            return NativeObject is IAsyncInfo;
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
        public bool IsObject()
        {
            return NativeObject is object;
        }
        public bool IsNull()
        {
            return NativeObject == null;
        }

        public static object ConvertNumber(Type nativeType, double number)
        {
            return System.Convert.ChangeType(number, nativeType);
        }

        public object addEventListener(string name, object target, Type helper)
        {
            string methodName = String.Format("add_{0}_{1}", name, NativeType.FullName.Replace(".", "_"));
            Type[] types = { typeof(object) };
            MethodInfo method = helper.GetRuntimeMethod(methodName, types);
            object[] args = { target };
            return method.Invoke(null, args);
        }

        public object removeEventListener(string name, object evt, object target, Type helper)
        {
            string methodName = String.Format("remove_{0}_{1}", name, NativeType.FullName.Replace(".", "_"));
            Type[] types = { typeof(object), typeof(object) };
            MethodInfo method = helper.GetRuntimeMethod(methodName, types);
            object[] args = { evt, target };
            return method.Invoke(null, args);
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
        public static int HitCount { get; set;  }
        public static int MissedCount { get; set; }
        public static int CacheCount { get { return methodCache.Size(); } }
        private static LRUCache<Type, LRUCache<string, LRUCache<int, IList<Method>>>> methodCache;
        public string Name { get; set; }
        private MethodInfo methodInfo;

        static Method() {
            methodCache = new LRUCache<Type, LRUCache<string, LRUCache<int, IList<Method>>>>();
        }

        public Method(string name)
        {
            Name = name;
        }

        //
        // Shorthand for invoking method with no arguments
        //
        public object Invoke(object instanceObj)
        {
            return methodInfo.Invoke(instanceObj, null);
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
            try
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
            catch
            {
                return null;
            }
        }
        private static bool TryGetCachedMethod(Type type, string name, int expectedCount, out IList<Method> cachedMethods)
        {
            LRUCache<string, LRUCache<int, IList<Method>>> cachedNames;
            if (methodCache.TryGetValue(type, out cachedNames))
            {
                // Match method name
                LRUCache<int, IList<Method>> cachedParams;
                if (cachedNames.TryGetValue(name, out cachedParams))
                {
                    HitCount++;
                    if (cachedParams == null)
                    {
                        // cachedParams can be null when we know there's no such method
                        cachedMethods = null;
                        return false;
                    }

                    // Match parameter count
                    if (cachedParams.TryGetValue(expectedCount, out cachedMethods))
                    {
                        return true;
                    }
                }
            }
            MissedCount++;
            cachedMethods = null;
            return false;
        }
        private static void UpdateCache(Type type, string name, int expectedCount, IList<Method> methodList)
        {
            LRUCache<string, LRUCache<int, IList<Method>>> cachedNames;
            LRUCache<int, IList<Method>> cachedParams = null;
            if (methodCache.TryGetValue(type, out cachedNames))
            {
                cachedNames.TryGetValue(name, out cachedParams);
                if (cachedParams == null)
                {
                    cachedParams = new LRUCache<int, IList<Method>>();
                }
            }
            else
            {
                cachedNames  = new LRUCache<string, LRUCache<int, IList<Method>>>();
                cachedParams = new LRUCache<int, IList<Method>>();
            }

            cachedParams.Add(expectedCount, methodList);
            cachedNames.Add(name, cachedParams);
            methodCache.Add(type, cachedNames);
        }
        public static IList<Method> GetMethods(Type type, string name, int expectedCount)
        {
            //
            // Check method cache first
            //
            IList<Method> cachedMethods;
            if (TryGetCachedMethod(type, name, expectedCount, out cachedMethods))
            {
                return cachedMethods;
            }

            IList<Method> methodList = new List<Method>();
            var methods = type.GetRuntimeMethods();
            foreach (MethodInfo methodInfo in methods)
            {
                if (methodInfo.Name.Equals(name) && methodInfo.GetParameters().Length == expectedCount)
                {
                    Method method = new Method(name);
                    method.methodInfo = methodInfo;
                    methodList.Add(method);
                }
            }

            UpdateCache(type, name, expectedCount, methodList);

            return methodList;
        }
        public static bool HasMethod(Type type, string name)
        {
            //
            // Check method cache first
            //
            LRUCache<string, LRUCache<int, IList<Method>>> cached = null;
            if (methodCache.TryGetValue(type, out cached))
            {
                LRUCache<int, IList<Method>> mCached;
                if (cached.TryGetValue(name, out mCached))
                {
                    // This can be null when we know this method does not exist
                    return mCached != null;
                }
            }

            var methods = type.GetRuntimeMethods();
            foreach (MethodInfo methodInfo in methods)
            {
                if (methodInfo.Name.Equals(name))
                {
                    return true;
                }
            }

            // We can't find the method, then we marks it as "not available"
            if (cached == null)
            {
                cached = new LRUCache<string, LRUCache<int, IList<Method>>>();
            }
            cached.Add(name, null);
            methodCache.Add(type, cached);
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
        private FieldInfo fieldInfo;
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
            if (propertyInfo != null)
            {
                object value = propertyInfo.GetValue(obj);
                return new Instance(propertyInfo.PropertyType, value);
            }
            else if (fieldInfo != null)
            {
                object value = fieldInfo.GetValue(null);
                return new Instance(fieldInfo.FieldType, value);
            }

            return null;
        }
        public void SetValue(Instance instance, Instance value)
        {
            if (propertyInfo != null)
            {
                propertyInfo.SetValue(instance.NativeObject, value.NativeObject);
            }
        }
        public Type GetPropertyType()
        {
            if (propertyInfo != null)
            {
                return propertyInfo.PropertyType;
            }
            else if (fieldInfo != null)
            {
                return fieldInfo.FieldType;
            }
            return null;
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

            // Enum
            FieldInfo fieldInfo = type.GetRuntimeField(name);
            if (fieldInfo != null)
            {
                Property property = new Property(name);
                property.fieldInfo = fieldInfo;
                return property;
            }

            return null;
        }
        public static bool HasProperty(Type type, string name)
        {
            return GetProperty(type, name) != null;
        }
    }

    class LRUCache<K, V>
    {
        public int Capacity { get; set; }
        private Dictionary<K, Node> cache   = new Dictionary<K, Node>();
        private LinkedList<Node>    lruList = new LinkedList<Node>();

        public LRUCache()
        {
            Capacity = 100;
        }

        public LRUCache(int capacity)
        {
            Capacity = capacity;
        }

        public int Size()
        {
            return cache.Count;
        }

        public void Verify()
        {
            if (cache.Count != lruList.Count)
            {
                throw new Exception("HyperloopInvocation.LRUCache has invalid state.");
            }
        }

        public bool ContainsKey(K key)
        {
            lock(cache)
            {
                return cache.ContainsKey(key);
            }
        }

        public bool TryGetValue(K key, out V value)
        {
            lock (cache)
            {
                Verify();
                Node node;
                value = default(V);

                if (!cache.TryGetValue(key, out node))
                {
                    return false;
                }

                value = node.Value;

                lruList.Remove(node);
                lruList.AddLast(node);
                Verify();
            }

            return true;
        }

        public void Add(K key, V value)
        {
            lock (cache)
            {
                if (cache.Count >= Capacity)
                {
                    Purge();
                }

                Node node;
                if (cache.TryGetValue(key, out node))
                {
                    // Remove existing value in case we already cached it
                    lruList.Remove(node);
                    cache.Remove(key);
                }

                node = new Node(key, value);
                LinkedListNode<Node> lruNode = new LinkedListNode<Node>(node);
                lruList.AddLast(lruNode);
                cache.Add(key, node);
            }
        }

        private void Purge()
        {
            var node = lruList.First;
            cache.Remove(node.Value.Key);
            lruList.RemoveFirst();
        }

        private class Node
        {
            public V Value   { get; set; }
            public K Key     { get; set; }

            public Node(K key, V value)
            {
                Key   = key;
                Value = value;
            }
        }
    }

}

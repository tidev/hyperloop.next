package hyperloop;

import static org.junit.Assert.*;

import org.appcelerator.kroll.KrollDict;
import org.junit.Test;


public class InstanceProxyTest {

    private static final double DOUBLE_DELTA = 0.001; // delta value to use for JUnit's assertEquals double comparisons

	public static class Whatever {
        public byte primitiveByte = 3;
        public byte[] primitiveByteArray = new byte[] {0, 2};
        public char primitiveChar = 'a';
        public char[] primitiveCharArray = new char[] {'a', 'b', 'c'};
        public double primitiveDouble = 0.3;
        public double[] primitiveDoubleArray = new double[] { 1.3, 2.4 };
        public float primitiveFloat = 3.14f;
        public float[] primitiveFloatArray = new float[] { 100.5f, 123.456f };
        public int primitiveInt = 1;
        public int[] primitiveIntArray = new int[] {1, 2, 3};
        public long primitiveLong = 123L;
        public long[] primitiveLongArray = new long[] {7, 8, 9, 10};
        public short primitiveShort = (short) 2;
        public short[] primitiveShortArray = new short[] {3, 2, 1};

        public void setByte(byte b) {
            primitiveByte = b;
        };

        public void setByteArray(byte[] value) {
            primitiveByteArray = value;
        };

        public void setChar(char c) {
            primitiveChar = c;
        };

        public void setCharArray(char[] value) {
            primitiveCharArray = value;
        };

        public void setDouble(double c) {
            primitiveDouble = c;
        };

        public void setDoubleArray(double[] value) {
            primitiveDoubleArray = value;
        };

        public void setFloat(float c) {
            primitiveFloat = c;
        };

        public void setFloatArray(float[] value) {
            primitiveFloatArray = value;
        };

        public void setInt(int c) {
            primitiveInt = c;
        };

        public void setIntArray(int[] value) {
            primitiveIntArray = value;
        };

        public void setLong(long c) {
            primitiveLong = c;
        };

        public void setLongArray(long[] value) {
            primitiveLongArray = value;
        };

        public void setShort(short c) {
            primitiveShort = c;
        };

        public void setShortArray(short[] value) {
            primitiveShortArray = value;
        };
    }

    // TODO Add tests where the JS bridge gives us Doubles instead of Integers!
    @Test
    public void testSetNativeFieldPrimitiveByte() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        assertEquals(3, w.primitiveByte);
        ip.setNativeField("primitiveByte", 1);
        assertEquals(1, w.primitiveByte);
        // Because our JS bridge doesn't understand byte, we convert to short for it!
        Object result = ip.getNativeField("primitiveByte");
        assertEquals(Short.valueOf((short) 1), result);
        assertEquals(Short.class, result.getClass());
    }

    @Test
    public void testPrimitiveByteMethodArgument() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        KrollDict dict = new KrollDict();
        dict.put("func", "setByte");
        dict.put("instanceMethod", true);
        // arguments array holds a single argument, which is an Integer
        dict.put("args", new Object[] { Integer.valueOf(0) });
        ip.callNativeFunction(new Object[] { dict });
        assertEquals(0, w.primitiveByte);
    }

    @Test
    public void testSetNativeFieldPrimitiveByteArray() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        assertEquals(2, w.primitiveByteArray.length);
        assertEquals(0, w.primitiveByteArray[0]);
        assertEquals(2, w.primitiveByteArray[1]);
        ip.setNativeField("primitiveByteArray", new Object[] { Integer.valueOf(5), Integer.valueOf(2), Integer.valueOf(1), Integer.valueOf(6) });
        assertEquals(4, w.primitiveByteArray.length);
        assertEquals(5, w.primitiveByteArray[0]);
        assertEquals(2, w.primitiveByteArray[1]);
        assertEquals(1, w.primitiveByteArray[2]);
        assertEquals(6, w.primitiveByteArray[3]);
        // Because our JS bridge doesn't understand byte, we convert to short for it!
        Object result = ip.getNativeField("primitiveByteArray");
        assertEquals(short[].class, result.getClass());
        short[] shortArray = (short[]) result;
        assertEquals(4, shortArray.length);
        assertEquals(5, shortArray[0]);
        assertEquals(2, shortArray[1]);
        assertEquals(1, shortArray[2]);
        assertEquals(6, shortArray[3]);
    }

    @Test
    public void testPrimitiveByteArrayMethodArgument() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        KrollDict dict = new KrollDict();
        dict.put("func", "setByteArray");
        dict.put("instanceMethod", true);
        // arguments array holds a single argument, which is defined as an array of Objects, and contains two Integers inside.
        dict.put("args", new Object[] { new Object[] { Integer.valueOf(0), Integer.valueOf(1) } });
        ip.callNativeFunction(new Object[] { dict });
        assertEquals(2, w.primitiveByteArray.length);
        assertEquals(0, w.primitiveByteArray[0]);
        assertEquals(1, w.primitiveByteArray[1]);
    }
    @Test
    public void testSetNativeFieldPrimitiveChar() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        assertEquals('a', w.primitiveChar);
        ip.setNativeField("primitiveChar", 'b');
        assertEquals('b', w.primitiveChar);
        // Because this is JS facing API, we convert char to String for JS!
        Object result = ip.getNativeField("primitiveChar");
        assertEquals("b", result);
    }

    @Test
    public void testPrimitiveCharMethodArgumentWithStringLengthOne() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        KrollDict dict = new KrollDict();
        dict.put("func", "setChar");
        dict.put("instanceMethod", true);
        dict.put("args", new Object[] { "z" });
        ip.callNativeFunction(new Object[] { dict });
        assertEquals('z', w.primitiveChar);
    }

    @Test
    public void testPrimitiveCharMethodArgumentWithIntegerInRange() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        KrollDict dict = new KrollDict();
        dict.put("func", "setChar");
        dict.put("instanceMethod", true);
        dict.put("args", new Object[] { Integer.valueOf(65) }); // 'A'
        ip.callNativeFunction(new Object[] { dict });
        assertEquals('A', w.primitiveChar);
    }

    @Test
    public void testSetNativeFieldPrimitiveCharWithString() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        assertEquals('a', w.primitiveChar);
        ip.setNativeField("primitiveChar", "s");
        assertEquals('s', w.primitiveChar);
    }

    @Test
    public void testSetNativeFieldPrimitiveCharArrayWithString() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        assertEquals(3, w.primitiveCharArray.length);
        assertEquals('a', w.primitiveCharArray[0]);
        assertEquals('b', w.primitiveCharArray[1]);
        assertEquals('c', w.primitiveCharArray[2]);
        ip.setNativeField("primitiveCharArray", "mystring");
        assertEquals(8, w.primitiveCharArray.length);
        assertEquals('m', w.primitiveCharArray[0]);
        assertEquals('y', w.primitiveCharArray[1]);
        assertEquals('s', w.primitiveCharArray[2]);
        assertEquals('t', w.primitiveCharArray[3]);
        assertEquals('r', w.primitiveCharArray[4]);
        assertEquals('i', w.primitiveCharArray[5]);
        assertEquals('n', w.primitiveCharArray[6]);
        assertEquals('g', w.primitiveCharArray[7]);
        // Because this is JS facing API, we convert char to String for JS!
        Object result = ip.getNativeField("primitiveCharArray");
        assertEquals("mystring", result);
    }

    @Test
    public void testSetNativeFieldPrimitiveDouble() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        assertEquals(0.3, w.primitiveDouble, DOUBLE_DELTA);
        ip.setNativeField("primitiveDouble", Integer.valueOf(42));
        assertEquals(42, w.primitiveDouble, DOUBLE_DELTA);
    }

    @Test
    public void testPrimitiveDoubleMethodArgument() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        KrollDict dict = new KrollDict();
        dict.put("func", "setInt");
        dict.put("instanceMethod", true);
        // arguments array holds a single argument, which is an Integer
        dict.put("args", new Object[] { Integer.valueOf(99) });
        ip.callNativeFunction(new Object[] { dict });
        assertEquals(99, w.primitiveInt);
    }

    @Test
    public void testSetNativeFieldPrimitiveDoubleArray() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        assertEquals(2, w.primitiveDoubleArray.length);
        assertEquals(1.3, w.primitiveDoubleArray[0], DOUBLE_DELTA);
        assertEquals(2.4, w.primitiveDoubleArray[1], DOUBLE_DELTA);
        // From JS we get a generic Object[] holding boxed Integers
        ip.setNativeField("primitiveDoubleArray", new Object[] { Integer.valueOf(1), Integer.valueOf(3), Integer.valueOf(3), Integer.valueOf(7) });
        assertEquals(4, w.primitiveDoubleArray.length);
        assertEquals(1, w.primitiveDoubleArray[0], DOUBLE_DELTA);
        assertEquals(3, w.primitiveDoubleArray[1], DOUBLE_DELTA);
        assertEquals(3, w.primitiveDoubleArray[2], DOUBLE_DELTA);
        assertEquals(7, w.primitiveDoubleArray[3], DOUBLE_DELTA);
    }

    @Test
    public void testPrimitiveDoubleArrayMethodArgument() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        KrollDict dict = new KrollDict();
        dict.put("func", "setDoubleArray");
        dict.put("instanceMethod", true);
        // arguments array holds a single argument, which is an Integer
        dict.put("args", new Object[] { new Object[] { Integer.valueOf(99) } });
        ip.callNativeFunction(new Object[] { dict });
        assertEquals(1, w.primitiveDoubleArray.length);
        assertEquals(99, w.primitiveDoubleArray[0], DOUBLE_DELTA);
    }

    @Test
    public void testSetNativeFieldPrimitiveFloat() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        assertEquals(3.14f, w.primitiveFloat, DOUBLE_DELTA);
        ip.setNativeField("primitiveFloat", Integer.valueOf(42));
        assertEquals(42f, w.primitiveFloat, DOUBLE_DELTA);
    }

    @Test
    public void testPrimitiveFloatMethodArgument() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        KrollDict dict = new KrollDict();
        dict.put("func", "setInt");
        dict.put("instanceMethod", true);
        // arguments array holds a single argument, which is an Integer
        dict.put("args", new Object[] { Integer.valueOf(99) });
        ip.callNativeFunction(new Object[] { dict });
        assertEquals(99, w.primitiveInt);
    }

    @Test
    public void testSetNativeFieldPrimitiveFloatArray() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        assertEquals(2, w.primitiveFloatArray.length);
        assertEquals(100.5f, w.primitiveFloatArray[0], DOUBLE_DELTA);
        assertEquals(123.456f, w.primitiveFloatArray[1], DOUBLE_DELTA);
        // From JS we get a generic Object[] holding boxed Integers
        ip.setNativeField("primitiveFloatArray", new Object[] { Integer.valueOf(1), Integer.valueOf(3), Integer.valueOf(3), Integer.valueOf(7) });
        assertEquals(4, w.primitiveFloatArray.length);
        assertEquals(1f, w.primitiveFloatArray[0], DOUBLE_DELTA);
        assertEquals(3f, w.primitiveFloatArray[1], DOUBLE_DELTA);
        assertEquals(3f, w.primitiveFloatArray[2], DOUBLE_DELTA);
        assertEquals(7f, w.primitiveFloatArray[3], DOUBLE_DELTA);
    }

    @Test
    public void testPrimitiveFloatArrayMethodArgument() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        KrollDict dict = new KrollDict();
        dict.put("func", "setFloatArray");
        dict.put("instanceMethod", true);
        // arguments array holds a single argument, which is an Integer
        dict.put("args", new Object[] { new Object[] { Integer.valueOf(99) } });
        ip.callNativeFunction(new Object[] { dict });
        assertEquals(1, w.primitiveFloatArray.length);
        assertEquals(99, w.primitiveFloatArray[0], DOUBLE_DELTA);
    }

    @Test
    public void testSetNativeFieldPrimitiveInt() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        assertEquals(1, w.primitiveInt);
        ip.setNativeField("primitiveInt", Integer.valueOf(42));
        assertEquals(42, w.primitiveInt);
    }

    @Test
    public void testPrimitiveIntMethodArgument() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        KrollDict dict = new KrollDict();
        dict.put("func", "setInt");
        dict.put("instanceMethod", true);
        // arguments array holds a single argument, which is an Integer
        dict.put("args", new Object[] { Integer.valueOf(99) });
        ip.callNativeFunction(new Object[] { dict });
        assertEquals(99, w.primitiveInt);
    }

    @Test
    public void testSetNativeFieldPrimitiveIntArray() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        assertEquals(3, w.primitiveIntArray.length);
        assertEquals(1, w.primitiveIntArray[0]);
        assertEquals(2, w.primitiveIntArray[1]);
        assertEquals(3, w.primitiveIntArray[2]);
        // From JS we get a generic Object[] holding boxed Integers
        ip.setNativeField("primitiveIntArray", new Object[] { Integer.valueOf(1), Integer.valueOf(3), Integer.valueOf(3), Integer.valueOf(7) });
        assertEquals(4, w.primitiveIntArray.length);
        assertEquals(1, w.primitiveIntArray[0]);
        assertEquals(3, w.primitiveIntArray[1]);
        assertEquals(3, w.primitiveIntArray[2]);
        assertEquals(7, w.primitiveIntArray[3]);
    }

    @Test
    public void testPrimitiveIntArrayMethodArgument() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        KrollDict dict = new KrollDict();
        dict.put("func", "setIntArray");
        dict.put("instanceMethod", true);
        // arguments array holds a single argument, which is an Integer
        dict.put("args", new Object[] { new Object[] { Integer.valueOf(99) } });
        ip.callNativeFunction(new Object[] { dict });
        assertEquals(1, w.primitiveIntArray.length);
        assertEquals(99, w.primitiveIntArray[0]);
    }

    @Test
    public void testSetNativeFieldPrimitiveShort() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        assertEquals(2, w.primitiveShort);
        ip.setNativeField("primitiveShort", Integer.valueOf(7));
        assertEquals(7, w.primitiveShort);
    }

    @Test
    public void testSetNativeFieldPrimitiveShortArray() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        assertEquals(3, w.primitiveShortArray.length);
        assertEquals(3, w.primitiveShortArray[0]);
        assertEquals(2, w.primitiveShortArray[1]);
        assertEquals(1, w.primitiveShortArray[2]);
        // from JS we get an Object array holding either Integer or Double
        ip.setNativeField("primitiveShortArray", new Object[] { Integer.valueOf(5), Integer.valueOf(2), Integer.valueOf(1), Integer.valueOf(6) });
        assertEquals(4, w.primitiveShortArray.length);
        assertEquals(5, w.primitiveShortArray[0]);
        assertEquals(2, w.primitiveShortArray[1]);
        assertEquals(1, w.primitiveShortArray[2]);
        assertEquals(6, w.primitiveShortArray[3]);
    }

    @Test
    public void testPrimitiveShortArrayMethodArgument() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        KrollDict dict = new KrollDict();
        dict.put("func", "setShortArray");
        dict.put("instanceMethod", true);
        // arguments array holds a single argument, which is an Integer
        // numbers from JS come in as Double or Integer
        dict.put("args", new Object[] { new Object[] { Integer.valueOf(99) } });
        ip.callNativeFunction(new Object[] { dict });
        assertEquals(1, w.primitiveShortArray.length);
        assertEquals(99, w.primitiveShortArray[0]);
    }

    @Test
    public void testSetNativeFieldPrimitiveLong() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        assertEquals(123L, w.primitiveLong);
        ip.setNativeField("primitiveLong", Integer.valueOf(5623));
        assertEquals(5623, w.primitiveLong);
    }

    @Test
    public void testSetNativeFieldPrimitiveLongArray() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        assertEquals(4, w.primitiveLongArray.length);
        assertEquals(7, w.primitiveLongArray[0]);
        assertEquals(8, w.primitiveLongArray[1]);
        assertEquals(9, w.primitiveLongArray[2]);
        assertEquals(10, w.primitiveLongArray[3]);
        ip.setNativeField("primitiveLongArray", new Object[] { Integer.valueOf(5), Integer.valueOf(2), Integer.valueOf(1), Integer.valueOf(6) });
        assertEquals(4, w.primitiveLongArray.length);
        assertEquals(5, w.primitiveLongArray[0]);
        assertEquals(2, w.primitiveLongArray[1]);
        assertEquals(1, w.primitiveLongArray[2]);
        assertEquals(6, w.primitiveLongArray[3]);
    }

}

package hyperloop;

import static org.junit.Assert.*;

import org.appcelerator.kroll.KrollDict;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;


public class InstanceProxyTest {

    private static final double DOUBLE_DELTA = 0.001; // delta value to use for JUnit's assertEquals double comparisons
    private static final int BYTE_DEFAULT = 3;
    private static final char CHAR_DEFAULT = 'a';
    private static final double DOUBLE_DEFAULT = 0.3;
    private static final float FLOAT_DEFAULT = 3.14f;
    private static final int INT_DEFAULT = 1;
    private static final long LONG_DEFAULT = 123L;
    private static final short SHORT_DEFAULT = (short) 2;

    public static class PrimitiveHolder {
        public byte primitiveByte = BYTE_DEFAULT;
        public byte[] primitiveByteArray = new byte[] {0, 2};
        public char primitiveChar = CHAR_DEFAULT;
        public char[] primitiveCharArray = new char[] {'a', 'b', 'c'};
        public double primitiveDouble = DOUBLE_DEFAULT;
        public double[] primitiveDoubleArray = new double[] { 1.3, 2.4 };
        public float primitiveFloat = FLOAT_DEFAULT;
        public float[] primitiveFloatArray = new float[] { 100.5f, 123.456f };
        public int primitiveInt = INT_DEFAULT;
        public int[] primitiveIntArray = new int[] {1, 2, 3};
        public long primitiveLong = LONG_DEFAULT;
        public long[] primitiveLongArray = new long[] {7, 8, 9, 10};
        public short primitiveShort = SHORT_DEFAULT;
        public short[] primitiveShortArray = new short[] {3, 2, 1};

        public void setByte(byte b) {
            primitiveByte = b;
        };

        public byte getByte() {
            return primitiveByte;
        }

        public void setByteArray(byte[] value) {
            primitiveByteArray = value;
        };
        
        public byte[] getByteArray() {
            return primitiveByteArray;
        }

        public void setChar(char c) {
            primitiveChar = c;
        };

        public char getChar() {
            return primitiveChar;
        }

        public void setCharArray(char[] value) {
            primitiveCharArray = value;
        };

        public char[] getCharArray() {
            return primitiveCharArray;
        }

        public void setDouble(double c) {
            primitiveDouble = c;
        };

        public double getDouble() {
            return primitiveDouble;
        }

        public void setDoubleArray(double[] value) {
            primitiveDoubleArray = value;
        };

        public double[] getDoubleArray() {
            return primitiveDoubleArray;
        }

        public void setFloat(float c) {
            primitiveFloat = c;
        };

        public float getFloat() {
            return primitiveFloat;
        }

        public void setFloatArray(float[] value) {
            primitiveFloatArray = value;
        };

        public float[] getFloatArray() {
            return primitiveFloatArray;
        }

        public void setInt(int c) {
            primitiveInt = c;
        };

        public int getInt() {
            return primitiveInt;
        }

        public void setIntArray(int[] value) {
            primitiveIntArray = value;
        };

        public int[] getIntArray() {
            return primitiveIntArray;
        }

        public void setLong(long c) {
            primitiveLong = c;
        };

        public long getLong() {
            return primitiveLong;
        }

        public void setLongArray(long[] value) {
            primitiveLongArray = value;
        };

        public long[] getLongArray() {
        	return primitiveLongArray;
        }

        public void setShort(short c) {
            primitiveShort = c;
        };

        public short getShort() {
            return primitiveShort;
        }

        public void setShortArray(short[] value) {
            primitiveShortArray = value;
        };

        public short[] getShortArray() {
        	return primitiveShortArray;
        }
    }

    private PrimitiveHolder w;
    private InstanceProxy ip;

    @Before
    public void runBeforeEveryTest() {
        w = new PrimitiveHolder();
        ip = new InstanceProxy(PrimitiveHolder.class, PrimitiveHolder.class.getName(), w);
    }

    @After
    public void runAfterEveryTest() {
        w = null;
        ip = null;
    }

    // TODO Add tests where the JS bridge gives us Doubles instead of Integers
    // TODO Add negative tests where we try to set fields/call methods with incompatible types
    // TODO Add tests where we try to set/get native fields that don't exist
    // TODO Add tests where we call methods with wrong number of arguments

    
    // byte
    @Test
    public void testSetNativeFieldPrimitiveByte() throws Exception {
        assertEquals(BYTE_DEFAULT, w.primitiveByte);
        ip.setNativeField("primitiveByte", Integer.valueOf(1));
        assertEquals(1, w.primitiveByte);
    }

    @Test
    public void testGetNativeFieldPrimitiveByte() throws Exception {
        // Because our JS bridge doesn't understand byte, we convert to short for it!
        Object result = ip.getNativeField("primitiveByte");
        assertEquals((short) BYTE_DEFAULT, result);
        assertEquals(Short.class, result.getClass());
    }

    @Test
    public void testMethodReturnsPrimitiveByteAsShort() throws Exception {
        // Because our JS bridge doesn't understand byte, we convert to short for it!
        Object result = ip.callNativeFunction(makeMethodCall("getByte"));
        assertEquals(Short.valueOf((short) BYTE_DEFAULT), result);
        assertEquals(Short.class, result.getClass());
    }

    @Test
    public void testPrimitiveByteMethodArgument() throws Exception {
        ip.callNativeFunction(makeMethodCall("setByte", Integer.valueOf(0)));
        assertEquals(0, w.primitiveByte);
    }

    // byte[]
    @Test
    public void testSetNativeFieldPrimitiveByteArray() throws Exception {
        assertEquals(2, w.primitiveByteArray.length);
        assertEquals(0, w.primitiveByteArray[0]);
        assertEquals(2, w.primitiveByteArray[1]);
        ip.setNativeField("primitiveByteArray", new Object[] { Integer.valueOf(5), Integer.valueOf(2), Integer.valueOf(1), Integer.valueOf(6) });
        assertEquals(4, w.primitiveByteArray.length);
        assertEquals(5, w.primitiveByteArray[0]);
        assertEquals(2, w.primitiveByteArray[1]);
        assertEquals(1, w.primitiveByteArray[2]);
        assertEquals(6, w.primitiveByteArray[3]);
    }

    @Test
    public void testGetNativeFieldPrimitiveByteArrayReturnsShortArray() throws Exception {
        // Because our JS bridge doesn't understand byte, we convert to short for it!
        Object result = ip.getNativeField("primitiveByteArray");
        assertEquals(short[].class, result.getClass());
        short[] shortArray = (short[]) result;
        assertEquals(2, shortArray.length);
        assertEquals(0, shortArray[0]);
        assertEquals(2, shortArray[1]);
    }

    @Test
    public void testPrimitiveByteArrayMethodArgument() throws Exception {
        // arguments array holds a single argument, which is defined as an array of Objects, and contains two Integers inside.
        ip.callNativeFunction(makeMethodCall("setByteArray", new Object[] { new Object[] { Integer.valueOf(0), Integer.valueOf(1) } }));
        assertEquals(2, w.primitiveByteArray.length);
        assertEquals(0, w.primitiveByteArray[0]);
        assertEquals(1, w.primitiveByteArray[1]);
    }

    @Test
    public void testMethodReturnsPrimitiveByteArrayAsShortArray() throws Exception {
        Object result = ip.callNativeFunction(makeMethodCall("getByteArray"));
        assertEquals(short[].class, result.getClass());
        short[] shortArray = (short[]) result;
        assertEquals(2, shortArray.length);
        assertEquals(0, shortArray[0]);
        assertEquals(2, shortArray[1]);
    }

    // char
    @Test
    public void testSetNativeFieldPrimitiveCharWithStringLengthOne() throws Exception {
        assertEquals(CHAR_DEFAULT, w.primitiveChar);
        ip.setNativeField("primitiveChar", "b");
        assertEquals('b', w.primitiveChar);
    }

    @Test
    public void testSetNativeFieldPrimitiveCharWithInRangeInteger() throws Exception {
        assertEquals(CHAR_DEFAULT, w.primitiveChar);
        ip.setNativeField("primitiveChar", Integer.valueOf(65));
        assertEquals('A', w.primitiveChar);
    }

    @Test
    public void testGetNativeFieldPrimitiveCharReturnsString() throws Exception {
        // Because this is JS facing API, we convert char to String for JS!
        Object result = ip.getNativeField("primitiveChar");
        assertEquals(String.class, result.getClass());
        assertEquals("" + CHAR_DEFAULT, result);
    }

    @Test
    public void testPrimitiveCharMethodArgumentWithStringLengthOne() throws Exception {
        ip.callNativeFunction(makeMethodCall("setChar", "z"));
        assertEquals('z', w.primitiveChar);
    }

    @Test
    public void testPrimitiveCharMethodArgumentWithIntegerInRange() throws Exception {
        ip.callNativeFunction(makeMethodCall("setChar", Integer.valueOf(65))); // 'A'
        assertEquals('A', w.primitiveChar);
    }

    @Test
    public void testMethodReturnsPrimitiveCharAsString() throws Exception {
        Object result = ip.callNativeFunction(makeMethodCall("getChar"));
        assertEquals("" + CHAR_DEFAULT, result);
    }

    // char[]
    @Test
    public void testSetNativeFieldPrimitiveCharArrayWithString() throws Exception {
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
    }

    @Test
    public void testGetNativeFieldPrimitiveCharArrayAsString() throws Exception {
        assertEquals(3, w.primitiveCharArray.length);
        assertEquals('a', w.primitiveCharArray[0]);
        assertEquals('b', w.primitiveCharArray[1]);
        assertEquals('c', w.primitiveCharArray[2]);
        // Because this is JS facing API, we convert char to String for JS!
        Object result = ip.getNativeField("primitiveCharArray");
        assertEquals(String.class, result.getClass());
        assertEquals("abc", result);
    }

    @Test
    public void testPrimitiveCharArrayMethodArgumentWithStringsOfLengthOne() throws Exception {
        ip.callNativeFunction(makeMethodCall("setCharArray", new Object[] { new Object[] { "h", "e", "l", "l", "o" } }));
        assertEquals(5, w.primitiveCharArray.length);
        assertEquals('h', w.primitiveCharArray[0]);
        assertEquals('e', w.primitiveCharArray[1]);
        assertEquals('l', w.primitiveCharArray[2]);
        assertEquals('l', w.primitiveCharArray[3]);
        assertEquals('o', w.primitiveCharArray[4]);
    }

    @Test
    public void testPrimitiveCharArrayMethodArgumentWithIntegersInValidRange() throws Exception {
        ip.callNativeFunction(makeMethodCall("setCharArray", new Object[] { new Object[] { 
            Integer.valueOf(72), Integer.valueOf(69), Integer.valueOf(76), Integer.valueOf(76), Integer.valueOf(79) } }));
        assertEquals(5, w.primitiveCharArray.length);
        assertEquals('H', w.primitiveCharArray[0]);
        assertEquals('E', w.primitiveCharArray[1]);
        assertEquals('L', w.primitiveCharArray[2]);
        assertEquals('L', w.primitiveCharArray[3]);
        assertEquals('O', w.primitiveCharArray[4]);
    }

    @Test
    public void testMethodReturnsPrimitiveCharArrayAsString() throws Exception {
        Object result = ip.callNativeFunction(makeMethodCall("getCharArray"));
        assertEquals(String.class, result.getClass());
        assertEquals("abc", result);
    }

    // double
    @Test
    public void testSetNativeFieldPrimitiveDouble() throws Exception {
        assertEquals(DOUBLE_DEFAULT, w.primitiveDouble, DOUBLE_DELTA);
        ip.setNativeField("primitiveDouble", Integer.valueOf(42));
        assertEquals(42, w.primitiveDouble, DOUBLE_DELTA);
    }

    @Test
    public void testGetNativeFieldPrimitiveDouble() throws Exception {
        Object result = ip.getNativeField("primitiveDouble");
        assertEquals(Double.class, result.getClass());
        assertEquals(DOUBLE_DEFAULT, (Double) result, DOUBLE_DELTA);
    }

    @Test
    public void testPrimitiveDoubleMethodArgument() throws Exception {
        ip.callNativeFunction(makeMethodCall("setDouble", Integer.valueOf(99)));
        assertEquals(99, w.primitiveDouble, DOUBLE_DELTA);
    }
    
    @Test
    public void testMethodReturnsPrimitiveDouble() throws Exception {
        Object result = ip.callNativeFunction(makeMethodCall("getDouble"));
        assertEquals(Double.class, result.getClass());
        assertEquals(DOUBLE_DEFAULT, result);
    }

    // double[]
    @Test
    public void testSetNativeFieldPrimitiveDoubleArray() throws Exception {
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
    public void testGetNativeFieldPrimitiveDoubleArray() throws Exception {
        Object result = ip.getNativeField("primitiveDoubleArray");
        double[] array = (double[]) result;
        assertEquals(2, array.length);
        assertEquals(1.3, array[0], DOUBLE_DELTA);
        assertEquals(2.4, array[1], DOUBLE_DELTA);
    }

    @Test
    public void testPrimitiveDoubleArrayMethodArgument() throws Exception {
        // arguments array holds a single argument, which is an Integer
        ip.callNativeFunction(makeMethodCall("setDoubleArray", new Object[] { new Object[] { Integer.valueOf(99) } }));
        assertEquals(1, w.primitiveDoubleArray.length);
        assertEquals(99, w.primitiveDoubleArray[0], DOUBLE_DELTA);
    }

    @Test
    public void testMethodReturnsPrimitiveDoubleArray() throws Exception {
        // arguments array holds a single argument, which is an Integer
        Object result = ip.callNativeFunction(makeMethodCall("getDoubleArray"));
        double[] array = (double[]) result;
        assertEquals(2, array.length);
        assertEquals(1.3, array[0], DOUBLE_DELTA);
        assertEquals(2.4, array[1], DOUBLE_DELTA);
    }

    // float
    @Test
    public void testSetNativeFieldPrimitiveFloat() throws Exception {
        assertEquals(FLOAT_DEFAULT, w.primitiveFloat, DOUBLE_DELTA);
        ip.setNativeField("primitiveFloat", Integer.valueOf(42));
        assertEquals(42f, w.primitiveFloat, DOUBLE_DELTA);
    }

    @Test
    public void testGetNativeFieldPrimitiveFloat() throws Exception {
        Object result = ip.getNativeField("primitiveFloat");
        assertEquals(Float.class,  result.getClass());
        assertEquals(FLOAT_DEFAULT, (Float) result, DOUBLE_DELTA);
    }

    @Test
    public void testPrimitiveFloatMethodArgument() throws Exception {
        ip.callNativeFunction(makeMethodCall("setFloat", Integer.valueOf(99)));
        assertEquals(99, w.primitiveFloat, DOUBLE_DELTA);
    }

    @Test
    public void testMethodReturnsPrimitiveFloat() throws Exception {
        Object result = ip.callNativeFunction(makeMethodCall("getFloat"));
        assertEquals(Float.class,  result.getClass());
        assertEquals(FLOAT_DEFAULT, (Float) result, DOUBLE_DELTA);
    }

    //float[]
    @Test
    public void testSetNativeFieldPrimitiveFloatArray() throws Exception {
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
    public void testGetNativeFieldPrimitiveFloatArray() throws Exception {
        Object result = ip.getNativeField("primitiveFloatArray");
        assertEquals(float[].class, result.getClass());
        float[] array = (float[]) result;
        assertEquals(2, array.length);
        assertEquals(100.5f, array[0], DOUBLE_DELTA);
        assertEquals(123.456f, array[1], DOUBLE_DELTA);
    }

    @Test
    public void testPrimitiveFloatArrayMethodArgument() throws Exception {
        ip.callNativeFunction(makeMethodCall("setFloatArray", new Object[] { new Object[] { Integer.valueOf(99) } }));
        assertEquals(1, w.primitiveFloatArray.length);
        assertEquals(99, w.primitiveFloatArray[0], DOUBLE_DELTA);
    }

    @Test
    public void testMethodReturnsPrimitiveFloatArray() throws Exception {
        Object result = ip.callNativeFunction(makeMethodCall("getFloatArray"));
        assertEquals(float[].class, result.getClass());
        float[] array = (float[]) result;
        assertEquals(2, array.length);
        assertEquals(100.5f, array[0], DOUBLE_DELTA);
        assertEquals(123.456f, array[1], DOUBLE_DELTA);
    }

    // int
    @Test
    public void testSetNativeFieldPrimitiveInt() throws Exception {
        assertEquals(INT_DEFAULT, w.primitiveInt);
        ip.setNativeField("primitiveInt", Integer.valueOf(42));
        assertEquals(42, w.primitiveInt);
    }

    @Test
    public void testGetNativeFieldPrimitiveInt() throws Exception {
        Object result = ip.getNativeField("primitiveInt");
        assertEquals(Integer.class, result.getClass());
        assertEquals(INT_DEFAULT, result);
    }

    @Test
    public void testPrimitiveIntMethodArgument() throws Exception {
        ip.callNativeFunction(makeMethodCall("setInt", Integer.valueOf(99)));
        assertEquals(99, w.primitiveInt);
    }

    @Test
    public void testMethodReturnsPrimitiveInt() throws Exception {
        Object result = ip.callNativeFunction(makeMethodCall("getInt"));
        assertEquals(Integer.class, result.getClass());
        assertEquals(INT_DEFAULT, result);
    }

    // int[]
    @Test
    public void testSetNativeFieldPrimitiveIntArray() throws Exception {
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
    public void testGetNativeFieldPrimitiveIntArray() throws Exception {
        Object result = ip.getNativeField("primitiveIntArray");
        assertEquals(int[].class, result.getClass());
        int[] array = (int[]) result;
        assertEquals(3, array.length);
        assertEquals(1, array[0]);
        assertEquals(2, array[1]);
        assertEquals(3, array[2]);
    }

    @Test
    public void testPrimitiveIntArrayMethodArgument() throws Exception {
        ip.callNativeFunction(makeMethodCall("setIntArray", new Object[] { new Object[] { Integer.valueOf(99) } }));
        assertEquals(1, w.primitiveIntArray.length);
        assertEquals(99, w.primitiveIntArray[0]);
    }
    
    @Test
    public void testMethodReturnsPrimitiveIntArray() throws Exception {
        Object result = ip.callNativeFunction(makeMethodCall("getIntArray"));
        assertEquals(int[].class, result.getClass());
        int[] array = (int[]) result;
        assertEquals(3, array.length);
        assertEquals(1, array[0]);
        assertEquals(2, array[1]);
        assertEquals(3, array[2]);
    }

    // short
    @Test
    public void testSetNativeFieldPrimitiveShort() throws Exception {
        assertEquals(SHORT_DEFAULT, w.primitiveShort);
        ip.setNativeField("primitiveShort", Integer.valueOf(7));
        assertEquals(7, w.primitiveShort);
    }

    @Test
    public void testGetNativeFieldPrimitiveShort() throws Exception {
        Object result = ip.getNativeField("primitiveShort");
        assertEquals(Short.class, result.getClass());
        assertEquals(SHORT_DEFAULT, result);
    }

    @Test
    public void testPrimitiveShortMethodArgument() throws Exception {
        // numbers from JS come in as Double or Integer
        ip.callNativeFunction(makeMethodCall("setShort", Integer.valueOf(99)));
        assertEquals(99, w.primitiveShort);
    }

    @Test
    public void testMethodReturnsPrimitiveShort() throws Exception {
        Object result = ip.callNativeFunction(makeMethodCall("getShort"));
        assertEquals(Short.class, result.getClass());
        assertEquals(SHORT_DEFAULT, result);
    }

    // short[]
    @Test
    public void testSetNativeFieldPrimitiveShortArray() throws Exception {
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
    public void testGetNativeFieldPrimitiveShortArray() throws Exception {
        Object result = ip.getNativeField("primitiveShortArray");
        assertEquals(short[].class, result.getClass());
        short[] array = (short[]) result;
        assertEquals(3, array.length);
        assertEquals(3, array[0]);
        assertEquals(2, array[1]);
        assertEquals(1, array[2]);
    }

    @Test
    public void testPrimitiveShortArrayMethodArgument() throws Exception {
        // numbers from JS come in as Double or Integer
        ip.callNativeFunction(makeMethodCall("setShortArray", new Object[] { new Object[] { Integer.valueOf(99) } }));
        assertEquals(1, w.primitiveShortArray.length);
        assertEquals(99, w.primitiveShortArray[0]);
    }

    @Test
    public void testMethodReturnsPrimitiveShortArray() throws Exception {
        Object result = ip.callNativeFunction(makeMethodCall("getShortArray"));
        assertEquals(short[].class, result.getClass());
        short[] array = (short[]) result;
        assertEquals(3, array.length);
        assertEquals(3, array[0]);
        assertEquals(2, array[1]);
        assertEquals(1, array[2]);
    }

    // long
    @Test
    public void testSetNativeFieldPrimitiveLong() throws Exception {
        assertEquals(LONG_DEFAULT, w.primitiveLong);
        ip.setNativeField("primitiveLong", Integer.valueOf(5623));
        assertEquals(5623, w.primitiveLong);
    }

    @Test
    public void testGetNativeFieldPrimitiveLong() throws Exception {
        Object result = ip.getNativeField("primitiveLong");
        assertEquals(Long.class, result.getClass());
        assertEquals(LONG_DEFAULT, result);
    }

    @Test
    public void testPrimitiveLongMethodArgument() throws Exception {
        // numbers from JS come in as Double or Integer
        ip.callNativeFunction(makeMethodCall("setLong", Integer.valueOf(99)));
        assertEquals(99, w.primitiveLong);
    }

    @Test
    public void testMethodReturnsPrimitiveLong() throws Exception {
        Object result = ip.callNativeFunction(makeMethodCall("getLong"));
        assertEquals(Long.class, result.getClass());
        assertEquals(LONG_DEFAULT, result);
    }

    // long[]
    @Test
    public void testSetNativeFieldPrimitiveLongArray() throws Exception {
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

    @Test
    public void testGetNativeFieldPrimitiveLongArray() throws Exception {
        Object result = ip.getNativeField("primitiveLongArray");
        assertEquals(long[].class, result.getClass());
        long[] array = (long[]) result;
        assertEquals(4, array.length);
        assertEquals(7, array[0]);
        assertEquals(8, array[1]);
        assertEquals(9, array[2]);
        assertEquals(10, array[3]);
    }

    @Test
    public void testPrimitiveLongArrayMethodArgument() throws Exception {
        // numbers from JS come in as Double or Integer
        ip.callNativeFunction(makeMethodCall("setLongArray", new Object[] { new Object[] { Integer.valueOf(5), Integer.valueOf(2), Integer.valueOf(1), Integer.valueOf(6) } }));
        assertEquals(4, w.primitiveLongArray.length);
        assertEquals(5, w.primitiveLongArray[0]);
        assertEquals(2, w.primitiveLongArray[1]);
        assertEquals(1, w.primitiveLongArray[2]);
        assertEquals(6, w.primitiveLongArray[3]);
    }

    @Test
    public void testMethodReturnsPrimitiveLongArray() throws Exception {
        Object result = ip.callNativeFunction(makeMethodCall("getLongArray"));
        assertEquals(long[].class, result.getClass());
        long[] array = (long[]) result;
        assertEquals(4, array.length);
        assertEquals(7, array[0]);
        assertEquals(8, array[1]);
        assertEquals(9, array[2]);
        assertEquals(10, array[3]);
    }

    private Object[] makeMethodCall(String methodName, Object... args) {
        KrollDict dict = new KrollDict();
        dict.put("func", methodName);
        dict.put("instanceMethod", true);
        dict.put("args", args);
        return new Object[] { dict };
    }
}

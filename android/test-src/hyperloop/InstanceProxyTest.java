package hyperloop;

import static org.junit.Assert.*;

import org.appcelerator.kroll.KrollDict;
import org.junit.Test;


public class InstanceProxyTest {

    public static class Whatever {
        public char primitiveChar = 'a';
        public char[] primitiveCharArray = new char[] {'a', 'b', 'c'};
        public int primitiveInt = 1;
        public int[] primitiveIntArray = new int[] {1, 2, 3};
        public short primitiveShort = (short) 2;
        public short[] primitiveShortArray = new short[] {3, 2, 1};
        public long primitiveLong = 123L;
        public long[] primitiveLongArray = new long[] {7, 8, 9, 10};
        public byte primitiveByte = 3;
        public byte[] primitiveByteArray = new byte[] {0, 2};

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
    public void testSetNativeFieldPrimitiveInt() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        assertEquals(1, w.primitiveInt);
        ip.setNativeField("primitiveInt", 42);
        assertEquals(42, w.primitiveInt);
    }

    @Test
    public void testSetNativeFieldPrimitiveIntArray() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        assertEquals(3, w.primitiveIntArray.length);
        assertEquals(1, w.primitiveIntArray[0]);
        assertEquals(2, w.primitiveIntArray[1]);
        assertEquals(3, w.primitiveIntArray[2]);
        ip.setNativeField("primitiveIntArray", new int[] { 1, 3, 3, 7 });
        assertEquals(4, w.primitiveIntArray.length);
        assertEquals(1, w.primitiveIntArray[0]);
        assertEquals(3, w.primitiveIntArray[1]);
        assertEquals(3, w.primitiveIntArray[2]);
        assertEquals(7, w.primitiveIntArray[3]);
    }

    @Test
    public void testSetNativeFieldPrimitiveShort() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        assertEquals(2, w.primitiveShort);
        ip.setNativeField("primitiveShort", 7);
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
        ip.setNativeField("primitiveShortArray", new short[] { 5, 2, 1, 6 });
        assertEquals(4, w.primitiveShortArray.length);
        assertEquals(5, w.primitiveShortArray[0]);
        assertEquals(2, w.primitiveShortArray[1]);
        assertEquals(1, w.primitiveShortArray[2]);
        assertEquals(6, w.primitiveShortArray[3]);
    }

    @Test
    public void testSetNativeFieldPrimitiveLong() throws Exception {
        Whatever w = new Whatever();
        InstanceProxy ip = new InstanceProxy(Whatever.class, Whatever.class.getName(), w);
        assertEquals(123L, w.primitiveLong);
        ip.setNativeField("primitiveLong", 5623);
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
        ip.setNativeField("primitiveLongArray", new long[] { 5, 2, 1, 6 });
        assertEquals(4, w.primitiveLongArray.length);
        assertEquals(5, w.primitiveLongArray[0]);
        assertEquals(2, w.primitiveLongArray[1]);
        assertEquals(1, w.primitiveLongArray[2]);
        assertEquals(6, w.primitiveLongArray[3]);
    }

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
        ip.setNativeField("primitiveByteArray", new byte[] { 5, 2, 1, 6 });
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
}

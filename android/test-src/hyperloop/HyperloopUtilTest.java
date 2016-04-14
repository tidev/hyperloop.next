package hyperloop;

import static org.junit.Assert.*;

import org.junit.Test;

public class HyperloopUtilTest {

	@Test
	public void testByteArrayGetsConvertedToShortArray() throws Exception {
		byte[] byteArray = new byte[] { 3, 4, 1 };
		Object result = HyperloopUtil.wrap(byte[].class, byteArray);
		assertEquals(short[].class, result.getClass());
		short[] shortArray = (short[]) result;
		assertEquals(3, shortArray.length);
		assertEquals(3, shortArray[0]);
		assertEquals(4, shortArray[1]);
		assertEquals(1, shortArray[2]);
	}

	@Test
	public void testCharacterConvertedToStringOfLength1() throws Exception {
		Character c = Character.valueOf('a');
		Object result = HyperloopUtil.wrap(Character.class, c);
		assertEquals(String.class, result.getClass());
		String string = (String) result;
		assertEquals(1, string.length());
		assertEquals("a", string);
	}

	@Test
	public void testPrimitiveCharArrayConvertedToString() throws Exception {
		char[] charArray = new char[] { 'a', 'w', 'e', 's', 'o', 'm', 'e' };
		Object result = HyperloopUtil.wrap(char[].class, charArray);
		assertEquals(String.class, result.getClass());
		String string = (String) result;
		assertEquals(7, string.length());
		assertEquals("awesome", string);
	}

	@Test
	public void testEmptyPrimitiveCharArrayConvertedToEmptyString() throws Exception {
		char[] charArray = new char[0];
		Object result = HyperloopUtil.wrap(char[].class, charArray);
		assertEquals(String.class, result.getClass());
		String string = (String) result;
		assertEquals(0, string.length());
		assertEquals("", string);
	}
}

import { assert, describe, test } from 'matchstick-as/assembly/index';
import { BigInt, ByteArray } from '@graphprotocol/graph-ts';

describe('AssemblyScript Endianness', () => {
  test('Should be little endian', () => {
    // create a 4 byte BigInt with value 1
    // 0x01000000 (not 0x00000001)
    const byteArray = ByteArray.fromBigInt(BigInt.fromI32(1));
    assert.i32Equals(4, byteArray.length);

    // you might not expect 0 here, but it's little endian
    // this is backwards from how solidity does it
    assert.i32Equals(1, byteArray[0]);
  });

  test('Should define bigInt from byte array', () => {
    // describes the relationship between BigInt and ByteArray
    const byteArray = new ByteArray(4);
    byteArray.fill(0x00);

    // setting the last byte to 1
    byteArray[3] = 0x01;

    const bi = BigInt.fromByteArray(byteArray);

    // this is backwards from how solidity does it
    assert.bigIntEquals(BigInt.fromI32(16777216), bi);

    // we need to reverse the array
    // this modifies the array in place...
    byteArray.reverse();

    const biReversed = BigInt.fromByteArray(byteArray);

    // now the non-zero byte is in front.
    assert.i32Equals(1, byteArray[0]);
    // and we get the correct value
    assert.bigIntEquals(BigInt.fromI32(1), biReversed);
  });

  test('Should define a positive bigInt from byte array', () => {
    // another problem is that, even with reversing the array
    // if the first bit is set, it will be interpreted as a negative number
    // the solution is to add a 0 byte to the front of the array
    // assemblyscript has a method for this: fromUnsignedBytes

    const byteArray = new ByteArray(4);
    // file with all ones
    byteArray.fill(0xff);

    const bi = BigInt.fromByteArray(byteArray);

    // expect a negative BigInt (first bit is set)
    assert.assertTrue(bi.lt(BigInt.fromI32(0)));
    // all ones is -1 in two's complement
    assert.bigIntEquals(BigInt.fromI32(-1), bi);

    const biUnsigned = BigInt.fromUnsignedBytes(byteArray);
    assert.assertTrue(biUnsigned.gt(BigInt.fromI32(0)));
    // // 2 ** 32 - 1
    assert.bigIntEquals(BigInt.fromU32(4294967295), biUnsigned);
  });
});

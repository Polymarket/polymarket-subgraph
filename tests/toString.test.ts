import { assert, describe, test } from 'matchstick-as/assembly/index';
import { BigInt } from '@graphprotocol/graph-ts';

describe('hexToDecimalString', () => {
  test('Should get decimal string from BigInt', () => {
    const bi = BigInt.fromI32(1234);
    assert.stringEquals('1234', bi.toString());
  });
});

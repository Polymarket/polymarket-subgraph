import { assert, describe, test } from 'matchstick-as/assembly/index';
import { BigInt } from '@graphprotocol/graph-ts';

describe('BigInt.sqrt()', () => {
  test('Should find sqrt of square', () => {
    assert.bigIntEquals(BigInt.fromI32(2), BigInt.fromI32(4).sqrt());
  });

  test('Should not find sqrt of non-square', () => {
    assert.bigIntEquals(BigInt.fromI32(4), BigInt.fromI32(5).sqrt());
  });
});

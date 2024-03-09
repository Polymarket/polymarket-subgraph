import { assert, describe, test } from 'matchstick-as/assembly/index';
import { BigInt } from '@graphprotocol/graph-ts';
import { indexSetContains } from '../common/utils/indexSetContains';

describe('indexSetContains', () => {
  test('It should check if index set contains the index', () => {
    const indexSet = BigInt.fromI32(0b1010);
    // @ts-expect-error Cannot find name 'u8'.
    assert.booleanEquals(false, indexSetContains(indexSet, <u8>0));
    // @ts-expect-error Cannot find name 'u8'.
    assert.booleanEquals(true, indexSetContains(indexSet, <u8>1));
    // @ts-expect-error Cannot find name 'u8'.
    assert.booleanEquals(false, indexSetContains(indexSet, <u8>2));
    // @ts-expect-error Cannot find name 'u8'.
    assert.booleanEquals(true, indexSetContains(indexSet, <u8>3));
  });

  test('It should check if index set contains the index 2', () => {
    const indexSet = BigInt.fromI32(16);
    // @ts-expect-error Cannot find name 'u8'.
    assert.booleanEquals(false, indexSetContains(indexSet, <u8>0));
    // @ts-expect-error Cannot find name 'u8'.
    assert.booleanEquals(false, indexSetContains(indexSet, <u8>1));
    // @ts-expect-error Cannot find name 'u8'.
    assert.booleanEquals(false, indexSetContains(indexSet, <u8>2));
    // @ts-expect-error Cannot find name 'u8'.
    assert.booleanEquals(false, indexSetContains(indexSet, <u8>3));
    // @ts-expect-error Cannot find name 'u8'.
    assert.booleanEquals(true, indexSetContains(indexSet, <u8>4));
  });
});

/* eslint-disable @typescript-eslint/ban-types */

import { BigInt } from '@graphprotocol/graph-ts';

// ex: indexSet = 00010000
// if questionIndex = 4, then 1 << 4 = 00010000
// so indexSet AND (1 << questionIndex) = 00010000 > 0
// if questionIndex = 2, then 1 << 2 = 00000100
// so indexSet AND (1 << questionIndex) = 00000000 == 0

// @ts-expect-error Cannot find name 'u8'.
const indexSetContains = (indexSet: BigInt, index: u8): boolean => {
  return indexSet.bitAnd(BigInt.fromI32(1).leftShift(index)).gt(BigInt.zero());
};

export { indexSetContains };

import { BigInt } from '@graphprotocol/graph-ts';
import { bigZero } from './constants';

export function max(array: BigInt[]): BigInt {
  let len = array.length;
  let maxValue = bigZero;
  // eslint-disable-next-line no-plusplus
  while (len--) {
    if (array[len].gt(maxValue)) {
      maxValue = array[len];
    }
  }
  return maxValue;
}

export function min(array: BigInt[]): BigInt {
  let len = array.length;
  let minValue = BigInt.fromI32(i32.MAX_VALUE);
  // eslint-disable-next-line no-plusplus
  while (len--) {
    if (array[len].lt(minValue)) {
      minValue = array[len];
    }
  }
  return minValue;
}

import { BigDecimal, BigInt } from '@graphprotocol/graph-ts';
import { bigOne, bigZero } from './constants';

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

export function timesBD(a: BigInt, b: BigDecimal): BigInt {
  return a.toBigDecimal().times(b).truncate(0).digits;
}

export function increment(a: BigInt): BigInt {
  return a.plus(bigOne);
}

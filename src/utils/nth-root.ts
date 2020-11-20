import { log, BigInt } from '@graphprotocol/graph-ts';
import { bigZero, bigOne } from './constants';

// Adapted from https://en.wikipedia.org/wiki/Nth_root_algorithm
export function nthRoot(x: BigInt, n: i32): BigInt {
  if (n <= 0) {
    log.error('invalid n {} passed to nthRoot', [BigInt.fromI32(n).toString()]);
  }

  if (x.equals(bigZero)) {
    return bigZero;
  }

  let nAsBigInt = BigInt.fromI32(n);

  let root = x;
  let deltaRoot: BigInt;
  do {
    let rootPowNLess1 = bigOne;
    for (let i = 0; i < n - 1; i += 1) {
      rootPowNLess1 = rootPowNLess1.times(root);
    }
    deltaRoot = x.div(rootPowNLess1).minus(root).div(nAsBigInt);
    root = root.plus(deltaRoot);
  } while (deltaRoot.lt(bigZero));

  return root;
}

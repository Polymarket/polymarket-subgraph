import { log, BigInt } from '@graphprotocol/graph-ts'

// Adapted from https://en.wikipedia.org/wiki/Nth_root_algorithm
export function nthRoot(x: BigInt, n: i32): BigInt {
  if (n <= 0) {
    log.error("invalid n {} passed to nthRoot", [
      BigInt.fromI32(n).toString()
    ])
  }
  
  let zeroAsBigInt = BigInt.fromI32(0);

  if (x.equals(zeroAsBigInt)) {
    return zeroAsBigInt;
  }

  let nAsBigInt = BigInt.fromI32(n);

  let root = x;
  let deltaRoot: BigInt;
  do {
    let rootPowNLess1 = BigInt.fromI32(1);
    for (let i = 0; i < n - 1; i++) {
      rootPowNLess1 = rootPowNLess1.times(root);
    }
    deltaRoot = x.div(rootPowNLess1).minus(root).div(nAsBigInt);
    root = root.plus(deltaRoot);
  } while (deltaRoot.lt(zeroAsBigInt))

  return root;
}

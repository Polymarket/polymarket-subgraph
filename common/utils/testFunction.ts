import { BigInt } from '@graphprotocol/graph-ts';

const testFunction = (): BigInt => {
  return BigInt.fromI32(8);
};

export { testFunction };

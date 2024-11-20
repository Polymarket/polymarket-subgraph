import { BigInt } from '@graphprotocol/graph-ts';

export function timestampToDay(timestamp: BigInt): BigInt {
  return timestamp.div(BigInt.fromI32(86400));
}

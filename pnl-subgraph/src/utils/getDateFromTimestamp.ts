/* eslint-disable @typescript-eslint/ban-types */

import { BigInt } from '@graphprotocol/graph-ts';

const getDateFromTimestamp = (timestamp: BigInt): BigInt => {
  return timestamp.minus(timestamp.mod(BigInt.fromI32(86400)));
};

export { getDateFromTimestamp };

/* eslint-disable @typescript-eslint/ban-types */

import { Address, BigInt } from '@graphprotocol/graph-ts';

const getUserPositionEntityId = (user: Address, tokenId: BigInt): string => {
  return `${user.toHexString()}-${tokenId.toString()}`;
};

export { getUserPositionEntityId };

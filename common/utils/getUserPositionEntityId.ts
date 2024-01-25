/* eslint-disable @typescript-eslint/ban-types */

import { Address, BigInt } from '@graphprotocol/graph-ts';

const getUserPositionEntityId = (user: Address, positionId: BigInt): string => {
  return `${user.toHexString()}-${positionId.toString()}`;
};

export { getUserPositionEntityId };

/* eslint-disable @typescript-eslint/ban-types */

import { Address, BigInt } from '@graphprotocol/graph-ts';

const getUserPositionEntityId = (user: Address, positionId: BigInt): string => {
  return `${user.toHexString()}-${positionId.toHexString().padStart(66, '0')}`;
};

export { getUserPositionEntityId };

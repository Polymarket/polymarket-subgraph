/* eslint-disable @typescript-eslint/ban-types */

import { Address, BigInt } from '@graphprotocol/graph-ts';

import { UserPosition } from '../types/schema';

import { getUserPositionEntityId } from '../../../common';

const loadOrCreateUserPosition = (
  user: Address,
  tokenId: BigInt,
): UserPosition => {
  const userPositionEntityId = getUserPositionEntityId(user, tokenId);
  let userPosition = UserPosition.load(userPositionEntityId);

  if (userPosition == null) {
    userPosition = new UserPosition(userPositionEntityId);
    userPosition.user = user.toHexString();
    userPosition.tokenId = tokenId;
    userPosition.avgPrice = BigInt.zero();
    userPosition.amount = BigInt.zero();
    userPosition.realizedPnl = BigInt.zero();
    userPosition.totalBought = BigInt.zero();
  }

  return userPosition;
};

export { loadOrCreateUserPosition };

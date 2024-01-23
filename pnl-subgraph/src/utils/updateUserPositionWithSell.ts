/* eslint-disable @typescript-eslint/ban-types */

import { Address, BigInt } from '@graphprotocol/graph-ts';
import { UserPosition } from '../types/schema';
import { getUserPositionEntityId } from './getUserPositionEntityId';
import { COLLATERAL_SCALE } from '../constants';

const updateUserPositionWithSell = (
  user: Address,
  positionId: BigInt,
  price: BigInt,
  amount: BigInt,
): void => {
  const userPositionEntityId = getUserPositionEntityId(user, positionId);
  let userPosition = UserPosition.load(userPositionEntityId);

  if (userPosition === null) {
    userPosition = new UserPosition(userPositionEntityId);
  }

  // realizedPnl changes by
  // d = amount * (price - avgPrice)
  const deltaPnL = amount
    .times(price.minus(userPosition.avgPrice))
    .div(COLLATERAL_SCALE);

  // update realizedPnl
  userPosition.realizedPnl = userPosition.realizedPnl.plus(deltaPnL);

  // update amount
  userPosition.amount = userPosition.amount.minus(amount);

  userPosition.save();
};

export { updateUserPositionWithSell };

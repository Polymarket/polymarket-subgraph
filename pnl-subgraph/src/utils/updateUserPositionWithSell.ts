/* eslint-disable @typescript-eslint/ban-types */

import { Address, BigInt } from '@graphprotocol/graph-ts';

import { loadOrCreateUserPosition } from './loadOrCreateUserPosition';

import { COLLATERAL_SCALE } from '../../../common/constants';

const updateUserPositionWithSell = (
  user: Address,
  positionId: BigInt,
  price: BigInt,
  amount: BigInt,
): void => {
  let userPosition = loadOrCreateUserPosition(user, positionId);

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

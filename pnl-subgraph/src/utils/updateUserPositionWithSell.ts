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
  const userPosition = loadOrCreateUserPosition(user, positionId);

  // use userPosition amount if the amount is greater than the userPosition amount
  // that means the user obtained tokens outside of what we track
  // and we don't want to give them PnL for the extra
  const adjustedAmount = amount.gt(userPosition.amount)
    ? userPosition.amount
    : amount;

  // realizedPnl changes by
  // d = amount * (price - avgPrice)
  const deltaPnL = adjustedAmount
    .times(price.minus(userPosition.avgPrice))
    .div(COLLATERAL_SCALE);

  // update realizedPnl
  userPosition.realizedPnl = userPosition.realizedPnl.plus(deltaPnL);

  // update amount
  userPosition.amount = userPosition.amount.minus(adjustedAmount);
  userPosition.save();
};

export { updateUserPositionWithSell };

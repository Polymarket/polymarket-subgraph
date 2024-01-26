/* eslint-disable @typescript-eslint/ban-types */

import { Address, BigInt } from '@graphprotocol/graph-ts';

import { loadOrCreateUserPosition } from './loadOrCreateUserPosition';

const updateUserPositionWithBuy = (
  user: Address,
  positionId: BigInt,
  price: BigInt,
  amount: BigInt,
): void => {
  const userPosition = loadOrCreateUserPosition(user, positionId);

  if (amount.gt(BigInt.zero())) {
    // update average price
    // avgPrice = (avgPrice * userAmount + price * buyAmount)
    //          / (userAmount + buyAmount)
    const numerator = userPosition.avgPrice
      .times(userPosition.amount)
      .plus(price.times(amount));
    const denominator = userPosition.amount.plus(amount);
    userPosition.avgPrice = numerator.div(denominator);

    // update amount
    userPosition.amount = userPosition.amount.plus(amount);

    // update total bought
    userPosition.totalBought = userPosition.totalBought.plus(amount);

    userPosition.save();
  }
};

export { updateUserPositionWithBuy };

/* eslint-disable @typescript-eslint/ban-types */

import { Address, BigInt } from '@graphprotocol/graph-ts';
import { UserPosition } from '../types/schema';
import { getUserPositionEntityId } from './getUserPositionEntityId';

const updateUserPositionWithBuy = (
  user: Address,
  tokenId: BigInt,
  price: BigInt,
  amount: BigInt,
): void => {
  const userPositionEntityId = getUserPositionEntityId(user, tokenId);
  let userPosition = UserPosition.load(userPositionEntityId);
  if (userPosition == null) {
    userPosition = new UserPosition(userPositionEntityId);
  }

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
};

export { updateUserPositionWithBuy };

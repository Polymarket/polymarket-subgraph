/* eslint-disable @typescript-eslint/ban-types */

import {
  Address,
  BigDecimal,
  BigInt,
  Bytes,
  log,
} from '@graphprotocol/graph-ts';
import { MarketPosition, Condition, MarketData } from '../types/schema';
import { bigZero, TRADE_TYPE_BUY } from './constants';
import { updateUserProfit } from './account-utils';
import { OrderFilled } from '../types/Exchange/Exchange';
import { getPositionId } from './getPositionId';

declare type u8 = number;

/*
 * Returns the user's position for the given user and market(tokenId)
 * If no such position exists then a null position is generated
 */
export function getMarketPosition(
  user: Address,
  tokenId: BigInt,
): MarketPosition {
  let marketPositionId = user.toHexString() + tokenId.toString(); // user + market tokenID
  let marketPosition = MarketPosition.load(marketPositionId);
  if (marketPosition == null) {
    marketPosition = new MarketPosition(marketPositionId);
    marketPosition.market = tokenId.toString();
    marketPosition.user = user.toHexString();
    marketPosition.quantityBought = bigZero;
    marketPosition.quantitySold = bigZero;
    marketPosition.netQuantity = bigZero;
    marketPosition.valueBought = bigZero;
    marketPosition.valueSold = bigZero;
    marketPosition.netValue = bigZero;
    marketPosition.feesPaid = bigZero;
  }
  return marketPosition as MarketPosition;
}

function updateNetPositionAndSave(position: MarketPosition): void {
  position.netQuantity = position.quantityBought.minus(position.quantitySold);
  position.netValue = position.valueBought.minus(position.valueSold);

  // A user has somehow sold more tokens then they have received
  // This means that we're tracking balances incorrectly.
  //
  // Note: this can also be tripped by someone manually transferring tokens
  //       to another address in order to sell them.
  if (position.netQuantity.lt(bigZero)) {
    log.error(
      'Invalid position: user {} has negative netQuantity on market {}',
      [position.user, position.market],
    );
  }

  position.save();
}

/**
 * Update market position for the maker upon Order filled
 * Updates: MarketPosition, MarketData
 */
export function updateMarketPositionFromOrderFilled(
  maker: Address,
  tokenId: BigInt,
  side: string,
  event: OrderFilled,
): void {
  // Create/Update market position for the maker
  let position = getMarketPosition(maker, tokenId);
  let fee = event.params.fee;
  let makerAmountFilled = event.params.makerAmountFilled;
  let takerAmountNetFees = event.params.takerAmountFilled.minus(fee);
  let profit = bigZero;

  if (side == TRADE_TYPE_BUY) {
    position.quantityBought = position.quantityBought.plus(takerAmountNetFees);
    position.valueBought = position.valueBought.plus(makerAmountFilled);
    profit = makerAmountFilled.neg();
  } else {
    position.quantitySold = position.quantitySold.plus(makerAmountFilled);
    position.valueSold = position.valueSold.plus(takerAmountNetFees);
    profit = takerAmountNetFees;
  }

  let collateralScaleDec = new BigDecimal(BigInt.fromI32(10).pow(<u8>6));
  let mktData = MarketData.load(tokenId.toString());
  if (mktData != null) {
    updateUserProfit(
      maker.toHexString(),
      profit,
      collateralScaleDec,
      event.block.timestamp,
      mktData.condition,
    );
  }
  updateNetPositionAndSave(position);
}

/*
 * Updates a user's market position after manually splitting collateral
 */
export function updateMarketPositionsFromSplit(
  conditionId: Bytes,
  stakeholder: Address,
  amount: BigInt,
  negRisk: boolean,
): void {
  for (let outcomeIndex = 0; outcomeIndex < 2; outcomeIndex += 1) {
    const positionId = getPositionId(conditionId, outcomeIndex, negRisk);

    const marketPosition = getMarketPosition(stakeholder, positionId);

    // Event emits the amount of collateral to be split as `amount`
    marketPosition.quantityBought = marketPosition.quantityBought.plus(amount);

    updateNetPositionAndSave(marketPosition);
  }
}

/*
 * Updates a user's market position after a merge
 */
export function updateMarketPositionsFromMerge(
  conditionId: Bytes,
  stakeholder: Address,
  amount: BigInt,
  negRisk: boolean,
): void {
  for (let outcomeIndex = 0; outcomeIndex < 2; outcomeIndex += 1) {
    const positionId = getPositionId(conditionId, outcomeIndex, negRisk);

    const marketPosition = getMarketPosition(stakeholder, positionId);

    // Event emits the amount of outcome tokens to be merged as `amount`
    marketPosition.quantitySold = marketPosition.quantitySold.plus(amount);

    updateNetPositionAndSave(marketPosition);
  }
}

/*
 * Updates a user's market position after redeeming a position
 *
 */

export function updateMarketPositionsFromRedemption(
  conditionId: Bytes,
  redeemer: Address,
  indexSets: BigInt[],
  timestamp: BigInt,
  negRisk: boolean,
  amounts: BigInt[],
): void {
  const condition = Condition.load(conditionId.toHexString());
  if (condition === null) {
    return;
  }

  const payoutNumerators = condition.payoutNumerators as BigInt[];
  const payoutDenominator = condition.payoutDenominator as BigInt;

  for (let i = 0; i < indexSets.length; i += 1) {
    // Each element of indexSets is the decimal representation of the binary slot of the given outcome
    // i.e. For a condition with 4 outcomes, ["1", "2", "4"] represents the first 3 slots as 0b0111
    // We can get the relevant slot by shifting a bit until we hit the correct index, e.g. 4 = 1 << 3
    let outcomeIndex = 0;
    // we assume that each indexSet is a power of 2
    // eslint-disable-next-line no-bitwise
    while (1 << outcomeIndex < indexSets[i].toI32()) {
      outcomeIndex += 1;
    }

    const positionId = getPositionId(conditionId, outcomeIndex, negRisk);

    const marketPosition = getMarketPosition(redeemer, positionId);

    // either the full amount of the token
    // or, if neg risk, the specified amount
    const quantity = negRisk ? amounts[i] : marketPosition.netQuantity;

    const numerator = payoutNumerators[outcomeIndex];
    const redemptionValue = quantity.times(numerator).div(payoutDenominator);

    const collateralScaleDec = new BigDecimal(BigInt.fromI32(10).pow(<u8>6));
    updateUserProfit(
      redeemer.toHexString(),
      redemptionValue,
      collateralScaleDec,
      timestamp,
      conditionId.toHexString(),
    );

    // position gets zero'd out
    marketPosition.quantitySold = marketPosition.quantitySold.plus(quantity);
    // position.valueSold = position.valueSold.plus(redemptionValue);
    updateNetPositionAndSave(marketPosition);
  }
}

/* eslint-disable @typescript-eslint/ban-types */

import {
  Address,
  BigDecimal,
  BigInt,
  Bytes,
  ethereum,
  log,
} from '@graphprotocol/graph-ts';
import {
  MarketPosition,
  Condition,
  MarketData,
  Transaction,
  FixedProductMarketMaker,
} from '../types/schema';
import { bigZero, TRADE_TYPE_BUY } from './constants';
import { updateUserProfit } from './account-utils';
import { OrderFilled } from '../types/Exchange/Exchange';
import { getPositionId } from './getPositionId';
import { getCollateralScale } from './collateralTokens';
import {
  FPMMBuy,
  FPMMFundingAdded,
  FPMMFundingRemoved,
  FPMMSell,
} from '../types/FixedProductMarketMakerFactory/FixedProductMarketMakerFactory';
import { max, timesBD } from './maths';
import {
  COLLATERAL_SCALE,
  CONDITIONAL_TOKENS,
  TradeType,
  USDC,
} from '../../../common/constants';

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

export function updateMarketPositionFromFPMMBuy(
  event: FPMMBuy,
  conditionId: string,
) {
  const negRisk = false;
  const positionId = getPositionId(
    Bytes.fromHexString(conditionId),
    event.params.outcomeIndex.toI32(),
    negRisk,
  );
  const marketPosition = getMarketPosition(event.params.buyer, positionId);

  marketPosition.quantityBought = marketPosition.quantityBought.plus(
    event.params.outcomeTokensBought,
  );
  marketPosition.valueBought = marketPosition.valueBought.plus(
    event.params.investmentAmount,
  );
  marketPosition.feesPaid = marketPosition.feesPaid.plus(
    event.params.feeAmount,
  );

  // profit is negative
  const profit = event.params.investmentAmount.neg();
  updateUserProfit(
    event.params.buyer.toHexString(),
    profit,
    event.block.timestamp,
    conditionId,
  );

  updateNetPositionAndSave(marketPosition);
}

export function updateMarketPositionFromFPMMSell(
  event: FPMMSell,
  conditionId: string,
) {
  const negRisk = false;
  const positionId = getPositionId(
    Bytes.fromHexString(conditionId),
    event.params.outcomeIndex.toI32(),
    negRisk,
  );
  const marketPosition = getMarketPosition(event.params.seller, positionId);

  marketPosition.quantitySold = marketPosition.quantitySold.plus(
    event.params.outcomeTokensSold,
  );
  marketPosition.valueSold = marketPosition.valueSold.plus(
    event.params.returnAmount,
  );
  marketPosition.feesPaid = marketPosition.feesPaid.plus(
    event.params.feeAmount,
  );

  const profit = event.params.returnAmount;
  updateUserProfit(
    event.params.seller.toHexString(),
    profit,
    event.block.timestamp,
    conditionId,
  );

  updateNetPositionAndSave(marketPosition);
}

export function updateMarketPositionFromTrade(
  user: Address,
  outcomeIndex: u8,
  // fpmm: FixedProductMarketMaker,
  feeAmount: BigInt,
  tradeAmount: BigInt,
  outcomeTokensAmount: BigInt,
  conditionId: Bytes,
  type: string,
  timestamp: BigInt,
) {
  const negRisk = false;
  const positionId = getPositionId(conditionId, outcomeIndex, negRisk);
  const marketPosition = getMarketPosition(user, positionId);

  let profit = tradeAmount;

  if (type == TRADE_TYPE_BUY) {
    marketPosition.quantityBought =
      marketPosition.quantityBought.plus(outcomeTokensAmount);
    marketPosition.valueBought = marketPosition.valueBought.plus(tradeAmount);
    marketPosition.feesPaid = marketPosition.feesPaid.plus(feeAmount);
    // if buy, profit is negative
    profit = profit.neg();
  } else {
    marketPosition.quantitySold =
      marketPosition.quantitySold.plus(outcomeTokensAmount);
    marketPosition.valueSold = marketPosition.valueSold.plus(tradeAmount);
    marketPosition.feesPaid = marketPosition.feesPaid.plus(feeAmount);
  }

  updateUserProfit(
    user.toHexString(),
    profit,
    timestamp,
    conditionId.toHexString(),
  );

  updateNetPositionAndSave(marketPosition);
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

export function updateMarketPositionFromLiquidityAdded(
  event: FPMMFundingAdded,
): void {
  let fpmmAddress = event.address.toHexString();
  const fpmm = FixedProductMarketMaker.load(
    fpmmAddress,
  ) as FixedProductMarketMaker;
  let funder = event.params.funder.toHexString();
  let amountsAdded = event.params.amountsAdded;

  // The amounts of outcome token are limited by the cheapest outcome.
  // This will have the full balance added to the market maker
  // therefore this is the amount of collateral that the user has split.
  let addedFunds = max(amountsAdded);

  let outcomeTokenPrices = fpmm.outcomeTokenPrices;
  const conditionalTokenAddress = fpmm.conditionalTokenAddress;
  const conditions = fpmm.conditions;
  const collateralToken = fpmm.collateralToken.toString();
  const outcomeSlotCount = fpmm.outcomeSlotCount as number;

  if (conditions == null || conditions.length == 0) {
    log.error('LOG: Could not find conditions on the FPMM: {}', [fpmmAddress]);
    throw new Error(
      `ERR: Could not find conditions on the FPMM: ${fpmmAddress}`,
    );
  }

  // Funder is refunded with any excess outcome tokens which can't go into the market maker.
  // This means we must update the funder's market position for each outcome.
  for (
    let outcomeIndex = 0;
    outcomeIndex < amountsAdded.length;
    outcomeIndex += 1
  ) {
    // Event emits the number of outcome tokens added to the market maker
    // Subtract this from the amount of collateral added to get the amount refunded to funder
    let refundedAmount: BigInt = addedFunds.minus(amountsAdded[outcomeIndex]);
    if (refundedAmount.gt(bigZero)) {
      const condition = conditions[0];
      const market = getMarket(
        conditionalTokenAddress,
        condition,
        collateralToken,
        outcomeSlotCount,
        outcomeIndex,
      );

      // Only update positions which have changed
      let position = getMarketPosition(funder, market);

      position.quantityBought = position.quantityBought.plus(refundedAmount);

      let refundValue = timesBD(
        refundedAmount,
        outcomeTokenPrices[outcomeIndex],
      );
      position.valueBought = position.valueBought.plus(refundValue);

      updateNetPositionAndSave(position);
    }
  }
}

export function updateMarketPositionFromLiquidityRemoved(
  event: FPMMFundingRemoved,
): void {
  let fpmmAddress = event.address.toHexString();
  const fpmm = FixedProductMarketMaker.load(
    fpmmAddress,
  ) as FixedProductMarketMaker;
  let funder = event.params.funder.toHexString();
  let amountsRemoved = event.params.amountsRemoved;

  let outcomeTokenPrices = fpmm.outcomeTokenPrices;
  const conditionalTokenAddress = fpmm.conditionalTokenAddress;
  const conditions = fpmm.conditions;
  const collateralToken = fpmm.collateralToken.toString();
  const outcomeSlotCount = fpmm.outcomeSlotCount as number;

  if (conditions == null || conditions.length == 0) {
    log.error('LOG: Could not find conditions on the FPMM: {}', [fpmmAddress]);
    throw new Error(
      `ERR: Could not find conditions on the FPMM: ${fpmmAddress}`,
    );
  }

  // The funder is sent all of the outcome tokens for which they were providing liquidity
  // This means we must update the funder's market position for each outcome.
  for (
    let outcomeIndex = 0;
    outcomeIndex < amountsRemoved.length;
    outcomeIndex += 1
  ) {
    let condition = conditions[0];
    const market: string = getMarket(
      conditionalTokenAddress,
      condition,
      collateralToken,
      outcomeSlotCount,
      outcomeIndex,
    );

    let position = getMarketPosition(funder, market);

    let amountRemoved = amountsRemoved[outcomeIndex];
    position.quantityBought = position.quantityBought.plus(amountRemoved);

    let removedValue = timesBD(amountRemoved, outcomeTokenPrices[outcomeIndex]);
    position.valueBought = position.valueBought.plus(removedValue);

    updateNetPositionAndSave(position);
  }
}

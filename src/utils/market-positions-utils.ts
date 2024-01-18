import { Address, BigDecimal, BigInt, log } from '@graphprotocol/graph-ts';
import { MarketPosition, Condition, MarketData } from '../types/schema';
import {
  PositionsMerge,
  PositionSplit,
  PayoutRedemption,
} from '../types/ConditionalTokens/ConditionalTokens';
import { bigZero, TRADE_TYPE_BUY } from './constants';
import { updateUserProfit } from './account-utils';
import { OrderFilled } from '../types/Exchange/Exchange';
import { getPositionId } from './getPositionId';

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

/**
 * Handles FPMM trades
 * Updates: Transaction, MarketPosition
 */
// export function updateMarketPositionFromTrade(event: ethereum.Event): void {
//   let transaction = Transaction.load(event.transaction.hash.toHexString());
//   if (transaction == null) {
//     log.error('Could not find a transaction with hash: {}', [
//       event.transaction.hash.toString(),
//     ]);
//     throw new Error(
//       `Could not find transaction with hash: ${event.transaction.hash.toString()}`,
//     );
//   }

//   const fpmm = FixedProductMarketMaker.load(
//     transaction.market,
//   ) as FixedProductMarketMaker;

//   const conditionalTokenAddress = fpmm.conditionalTokenAddress;
//   const conditions = fpmm.conditions;
//   const collateralToken = fpmm.collateralToken.toString();
//   const outcomeSlotCount = fpmm.outcomeSlotCount as number;
//   const collateralScale = getCollateralScale(fpmm.collateralToken);
//   const collateralScaleDec = collateralScale.toBigDecimal();

//   if (conditions == null || conditions.length == 0) {
//     log.error('LOG: Could not find conditions on the FPMM: {}', [
//       transaction.market,
//     ]);
//     throw new Error(
//       `ERR: Could not find conditions on the FPMM: ${transaction.market.toString()}`,
//     );
//   }

//   // Calculate the market/tokenId from the conditionId and the outcome index
//   // Note: this assumes a single conditionId and a zero parentCollectionId
//   let condition = conditions[0];
//   const market = getMarket(
//     conditionalTokenAddress,
//     condition,
//     collateralToken,
//     outcomeSlotCount,
//     transaction.outcomeIndex.toI32(),
//   );

//   let position = getMarketPosition(transaction.user, market);

//   let fee = fpmm.fee;
//   // express the fee in terms of cash
//   let feeAmount = bigZero;
//   let profit = transaction.tradeAmount;

//   if (transaction.type == TRADE_TYPE_BUY) {
//     position.quantityBought = position.quantityBought.plus(
//       transaction.outcomeTokensAmount,
//     );
//     position.valueBought = position.valueBought.plus(transaction.tradeAmount);

//     // feeAmount = investmentAmount * fee
//     feeAmount = transaction.tradeAmount
//       .times(fee)
//       .div(BigInt.fromI32(10).pow(18));
//     position.feesPaid = position.feesPaid.plus(feeAmount);
//     // if buy, profit is negative
//     profit = profit.neg();
//   } else {
//     position.quantitySold = position.quantitySold.plus(
//       transaction.outcomeTokensAmount,
//     );
//     position.valueSold = position.valueSold.plus(transaction.tradeAmount);

//     // feeAmount = returnAmount * (fee/(1-fee));
//     feeAmount = transaction.tradeAmount
//       .times(fee)
//       .div(BigInt.fromI32(10).pow(18).minus(fee));
//     position.feesPaid = position.feesPaid.plus(feeAmount);
//   }

//   updateUserProfit(
//     transaction.user,
//     profit,
//     collateralScaleDec,
//     transaction.timestamp,
//     condition,
//   );

//   updateNetPositionAndSave(position);
// }

/*
 * Updates a user's market position after manually splitting collateral
 */
export function updateMarketPositionsFromSplit(
  event: PositionSplit,
  negRisk: boolean,
): void {
  for (let outcomeIndex = 0; outcomeIndex < 2; outcomeIndex += 1) {
    const positionId = getPositionId(
      event.params.conditionId,
      outcomeIndex,
      negRisk,
    );

    const marketPosition = getMarketPosition(
      event.params.stakeholder,
      positionId,
    );

    // Event emits the amount of collateral to be split as `amount`
    marketPosition.quantityBought = marketPosition.quantityBought.plus(
      event.params.amount,
    );

    updateNetPositionAndSave(marketPosition);
  }
}

/*
 * Updates a user's market position after a merge
 */
export function updateMarketPositionsFromMerge(
  event: PositionsMerge,
  negRisk: boolean,
): void {
  for (let outcomeIndex = 0; outcomeIndex < 2; outcomeIndex += 1) {
    const positionId = getPositionId(
      event.params.conditionId,
      outcomeIndex,
      negRisk,
    );

    const marketPosition = getMarketPosition(
      event.params.stakeholder,
      positionId,
    );

    // Event emits the amount of outcome tokens to be merged as `amount`
    marketPosition.quantitySold = marketPosition.quantitySold.plus(
      event.params.amount,
    );

    updateNetPositionAndSave(marketPosition);
  }
}

/*
 * Updates a user's market position after redeeming a position
 *
 */

export function updateMarketPositionsFromRedemption(
  event: PayoutRedemption,
  negRisk: boolean,
): void {
  if (Condition.load(event.params.conditionId.toHexString()) == null) {
    return;
  }

  const conditionId = event.params.conditionId.toHexString();
  const condition = Condition.load(conditionId) as Condition;
  const payoutNumerators = condition.payoutNumerators as BigInt[];
  const payoutDenominator = condition.payoutDenominator as BigInt;

  let indexSets = event.params.indexSets;
  for (let i = 0; i < indexSets.length; i += 1) {
    // Each element of indexSets is the decimal representation of the binary slot of the given outcome
    // i.e. For a condition with 4 outcomes, ["1", "2", "4"] represents the first 3 slots as 0b0111
    // We can get the relevant slot by shifting a bit until we hit the correct index, e.g. 4 = 1 << 3
    let outcomeIndex = 0;
    // eslint-disable-next-line no-bitwise
    while (1 << outcomeIndex < indexSets[i].toI32()) {
      outcomeIndex += 1;
    }
    const positionId = getPositionId(
      event.params.conditionId,
      outcomeIndex,
      negRisk,
    );

    const marketPosition = getMarketPosition(event.params.redeemer, positionId);

    // Redeeming a position is an all or nothing operation so use full balance for calculations
    const numerator = payoutNumerators[outcomeIndex];
    const redemptionValue = marketPosition.netQuantity
      .times(numerator)
      .div(payoutDenominator);

    const collateralScaleDec = new BigDecimal(BigInt.fromI32(10).pow(<u8>6));
    updateUserProfit(
      event.params.redeemer.toHexString(),
      redemptionValue,
      collateralScaleDec,
      event.block.timestamp,
      conditionId,
    );

    // position gets zero'd out
    marketPosition.quantitySold = marketPosition.quantitySold.plus(
      marketPosition.netQuantity,
    );
    // position.valueSold = position.valueSold.plus(redemptionValue);
    updateNetPositionAndSave(marketPosition);
  }
}

// export function updateMarketPositionFromLiquidityAdded(
//   event: FPMMFundingAdded,
// ): void {
//   let fpmmAddress = event.address.toHexString();
//   const fpmm = FixedProductMarketMaker.load(
//     fpmmAddress,
//   ) as FixedProductMarketMaker;
//   let funder = event.params.funder.toHexString();
//   let amountsAdded = event.params.amountsAdded;

//   // The amounts of outcome token are limited by the cheapest outcome.
//   // This will have the full balance added to the market maker
//   // therefore this is the amount of collateral that the user has split.
//   let addedFunds = max(amountsAdded);

//   let outcomeTokenPrices = fpmm.outcomeTokenPrices;
//   const conditionalTokenAddress = fpmm.conditionalTokenAddress;
//   const conditions = fpmm.conditions;
//   const collateralToken = fpmm.collateralToken.toString();
//   const outcomeSlotCount = fpmm.outcomeSlotCount as number;

//   if (conditions == null || conditions.length == 0) {
//     log.error('LOG: Could not find conditions on the FPMM: {}', [fpmmAddress]);
//     throw new Error(
//       `ERR: Could not find conditions on the FPMM: ${fpmmAddress}`,
//     );
//   }

//   // Funder is refunded with any excess outcome tokens which can't go into the market maker.
//   // This means we must update the funder's market position for each outcome.
//   for (
//     let outcomeIndex = 0;
//     outcomeIndex < amountsAdded.length;
//     outcomeIndex += 1
//   ) {
//     // Event emits the number of outcome tokens added to the market maker
//     // Subtract this from the amount of collateral added to get the amount refunded to funder
//     let refundedAmount: BigInt = addedFunds.minus(amountsAdded[outcomeIndex]);
//     if (refundedAmount.gt(bigZero)) {
//       const condition = conditions[0];
//       const market = getMarket(
//         conditionalTokenAddress,
//         condition,
//         collateralToken,
//         outcomeSlotCount,
//         outcomeIndex,
//       );

//       // Only update positions which have changed
//       let position = getMarketPosition(funder, market);

//       position.quantityBought = position.quantityBought.plus(refundedAmount);

//       let refundValue = timesBD(
//         refundedAmount,
//         outcomeTokenPrices[outcomeIndex],
//       );
//       position.valueBought = position.valueBought.plus(refundValue);

//       updateNetPositionAndSave(position);
//     }
//   }
// }

// export function updateMarketPositionFromLiquidityRemoved(
//   event: FPMMFundingRemoved,
// ): void {
//   let fpmmAddress = event.address.toHexString();
//   const fpmm = FixedProductMarketMaker.load(
//     fpmmAddress,
//   ) as FixedProductMarketMaker;
//   let funder = event.params.funder.toHexString();
//   let amountsRemoved = event.params.amountsRemoved;

//   let outcomeTokenPrices = fpmm.outcomeTokenPrices;
//   const conditionalTokenAddress = fpmm.conditionalTokenAddress;
//   const conditions = fpmm.conditions;
//   const collateralToken = fpmm.collateralToken.toString();
//   const outcomeSlotCount = fpmm.outcomeSlotCount as number;

//   if (conditions == null || conditions.length == 0) {
//     log.error('LOG: Could not find conditions on the FPMM: {}', [fpmmAddress]);
//     throw new Error(
//       `ERR: Could not find conditions on the FPMM: ${fpmmAddress}`,
//     );
//   }

//   // The funder is sent all of the outcome tokens for which they were providing liquidity
//   // This means we must update the funder's market position for each outcome.
//   for (
//     let outcomeIndex = 0;
//     outcomeIndex < amountsRemoved.length;
//     outcomeIndex += 1
//   ) {
//     let condition = conditions[0];
//     const market: string = getPositionIdByExchange(
//       conditionalTokenAddress,
//       condition,
//       collateralToken,
//       outcomeSlotCount,
//       outcomeIndex,
//     );

//     let position = getMarketPosition(funder, market);

//     let amountRemoved = amountsRemoved[outcomeIndex];
//     position.quantityBought = position.quantityBought.plus(amountRemoved);

//     let removedValue = timesBD(amountRemoved, outcomeTokenPrices[outcomeIndex]);
//     position.valueBought = position.valueBought.plus(removedValue);

//     updateNetPositionAndSave(position);
//   }
// }

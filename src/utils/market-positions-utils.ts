import { BigInt, EthereumEvent, log } from '@graphprotocol/graph-ts'
import { FixedProductMarketMaker, MarketPosition, Transaction, Condition } from "../../generated/schema";
import { PositionsMerge, PositionSplit, PayoutRedemption } from "../../generated/ConditionalTokens/ConditionalTokens";
import { FPMMFundingAdded, FPMMFundingRemoved } from '../../generated/templates/FixedProductMarketMaker/FixedProductMarketMaker';


/*
 * Returns the user's position for the given market and outcome
 * If no such position exists then a null position is generated
 */
export function getMarketPosition(user: string, market: string, outcomeIndex: BigInt): MarketPosition {
  let positionId = user + market + outcomeIndex.toString()
  let position = MarketPosition.load(positionId);
  if (position == null) {
    position = new MarketPosition(positionId);
    position.market = market;
    position.user = user;
    position.outcomeIndex = outcomeIndex;
    position.totalQuantity = BigInt.fromI32(0);
    position.totalValue = BigInt.fromI32(0);
  }
  return position as MarketPosition
}

export function updateMarketPositionFromTrade(event: EthereumEvent): void {
  let transaction = Transaction.load(event.transaction.hash.toHexString());
  if (transaction == null) {
    log.error(
      'Could not find a transaction with hash: {}',
      [event.transaction.hash.toString()],
    );
  }
  
  let position = getMarketPosition(transaction.user, transaction.market, transaction.outcomeIndex)
  position.totalQuantity = transaction.type == "Buy"
    ? position.totalQuantity.plus(transaction.outcomeTokensAmount)
    : position.totalQuantity.minus(transaction.outcomeTokensAmount);
  position.totalValue = transaction.type == "Buy"
    ? position.totalValue.plus(transaction.tradeAmount)
    : position.totalValue.minus(transaction.tradeAmount);
  position.save()
}

/*
 * Updates a user's market position after manually splitting collateral
 *
 * WARNING: This is only valid for markets which have a single condition
 * It assumes that the number of outcome slots on the market maker is equal to that on the condition
 */
export function updateMarketPositionsFromSplit(marketMakerAddress: string, event: PositionSplit) {
  let userAddress = event.transaction.from.toHexString();
  let marketMaker = FixedProductMarketMaker.load(marketMakerAddress);
  let totalSlots = marketMaker.outcomeSlotCount
  for (let outcomeIndex = 0; outcomeIndex < totalSlots; outcomeIndex++) {
    let position = getMarketPosition(userAddress, marketMakerAddress, BigInt.fromI32(outcomeIndex));
    // Event emits the amount of collateral to be split as `amount`
    position.totalQuantity = position.totalQuantity.plus(event.params.amount);

    // The user is essentially buys all tokens at an equal price 
    let mergeValue = event.params.amount.div(BigInt.fromI32(totalSlots))
    position.totalValue = position.totalValue.plus(mergeValue);
    position.save();
  }
}

/*
 * Updates a user's market position after a merge
 *
 * WARNING: This is only valid for markets which have a single condition
 * It assumes that the number of outcome slots on the market maker is equal to that on the condition
 */
export function updateMarketPositionsFromMerge(marketMakerAddress: string, event: PositionsMerge) {
  let userAddress = event.transaction.from.toHexString();
  let marketMaker = FixedProductMarketMaker.load(marketMakerAddress);
  let totalSlots = marketMaker.outcomeSlotCount
  for (let outcomeIndex = 0; outcomeIndex < totalSlots; outcomeIndex++) {
    let position = getMarketPosition(userAddress, marketMakerAddress, BigInt.fromI32(outcomeIndex));
    // Event emits the amount of collateral to be split as `amount`
    position.totalQuantity = position.totalQuantity.minus(event.params.amount);

    // We treat it as the user selling tokens for equal values
    // TODO: weight for the prices in the market maker.
    let mergeValue = event.params.amount.div(BigInt.fromI32(totalSlots))
    position.totalValue = position.totalValue.minus(mergeValue);
    position.save();
  }
}

/*
 * Updates a user's market position after redeeming a position
 *
 * WARNING: This is only valid for markets which have a single condition
 * It assumes that the number of outcome slots on the market maker is equal to that on the condition
 */
export function updateMarketPositionsFromRedemption(marketMakerAddress: string, event: PayoutRedemption) {
  let userAddress = event.transaction.from.toHexString();
  let redeemedSlots = event.params.indexSets;
  let condition = Condition.load(event.params.conditionId.toHexString());
  
  for (let i = 0; i < redeemedSlots.length; i++) { 
    let redeemedSlot = redeemedSlots[i]
    let position = getMarketPosition(userAddress, marketMakerAddress, redeemedSlot);

    // Redeeming a position is an all or nothing operation so use full balance for calculations
    let redemptionValue = position.totalQuantity
      .times(condition.payoutNumerators[redeemedSlot.toI32()])
      .div(condition.payoutDenominator)

    // position gets zero'd out
    position.totalQuantity = BigInt.fromI32(0);
    position.totalValue = position.totalValue.minus(redemptionValue);
    position.save();
  }
}

export function updateMarketPositionFromLiquidityAdded(event: FPMMFundingAdded): void {
  let fpmmAddress = event.address.toHexString();
  let funder = event.transaction.from.toHexString();
  let addedFunds = event.transaction.input.values[0]; // Amount of collateral added to the market maker
  let amountsAdded = event.params.amountsAdded;
  let totalRefundedValue = addedFunds.minus(event.params.sharesMinted)
  
  // Calculate the full number of outcome tokens which are refunded to the funder address
  let totalRefundedOutcomeTokens = BigInt.fromI32(0);
  for (let outcomeIndex = 0; outcomeIndex < amountsAdded.length; outcomeIndex++) {
    let refundedAmount = addedFunds.minus(amountsAdded[outcomeIndex]);
    totalRefundedOutcomeTokens = totalRefundedOutcomeTokens.plus(refundedAmount);
  }

  // Funder is refunded with any excess outcome tokens which can't go into the market maker.
  // This means we must update the funder's market position for each outcome.
  for (let outcomeIndex = 0; outcomeIndex < amountsAdded.length; outcomeIndex++) {
    let position = getMarketPosition(funder, fpmmAddress, BigInt.fromI32(outcomeIndex));
    // Event emits the number of outcome tokens added to the market maker
    // Subtract this from the amount of collateral added to get the amount refunded to funder
    let refundedAmount: BigInt = addedFunds.minus(amountsAdded[outcomeIndex]);
    position.totalQuantity = position.totalQuantity.plus(refundedAmount);

    // We weight the value of the refund by the fraction of all outcome tokens it makes up
    let refundValue = totalRefundedValue.times(refundedAmount).div(totalRefundedOutcomeTokens)
    position.totalValue = position.totalValue.plus(refundValue);
    position.save();
  }
}

export function updateMarketPositionFromLiquidityRemoved(event: FPMMFundingRemoved): void {
  let fpmmAddress = event.address.toHexString();
  let funder = event.transaction.from.toHexString();
  let amountsRemoved = event.params.amountsRemoved;
  let collateralRemoved = event.params.collateralRemovedFromFeePool;

  // Outcome tokens are removed in proportion to their balances in the market maker
  // Therefore the withdrawal of each outcome token should have the same value. 
  let pricePaidForTokens = collateralRemoved.div(BigInt.fromI32(amountsRemoved.length))

  // The funder is sent all of the outcome tokens for which they were providing liquidity
  // This means we must update the funder's market position for each outcome.
  for (let outcomeIndex = 0; outcomeIndex < amountsRemoved.length; outcomeIndex++) {
    let position = getMarketPosition(funder, fpmmAddress, BigInt.fromI32(outcomeIndex))
    position.totalQuantity = position.totalQuantity.plus(amountsRemoved[outcomeIndex])
    position.totalValue = position.totalValue.plus(pricePaidForTokens)
    position.save()
  }
}
import { BigDecimal, BigInt, ethereum, log } from '@graphprotocol/graph-ts';
import {
  FixedProductMarketMaker,
  MarketPosition,
  Transaction,
  Condition,
  MarketData,
} from '../types/schema';
import {
  PositionsMerge,
  PositionSplit,
  PayoutRedemption,
} from '../types/ConditionalTokens/ConditionalTokens';
import {
  FPMMFundingAdded,
  FPMMFundingRemoved,
} from '../types/templates/FixedProductMarketMaker/FixedProductMarketMaker';
import { bigOne, bigZero, TRADE_TYPE_BUY } from './constants';
import { max, timesBD } from './maths';
import { getMarket } from './ctf-utils';
import { updateUserProfit } from './account-utils';
import { getCollateralScale } from './collateralTokens';
import { OrderFilled } from '../types/Exchange/Exchange';

/*
 * Returns the user's position for the given user and market(tokenId)
 * If no such position exists then a null position is generated
 */
export function getMarketPosition(
  user: string,
  market: string,
): MarketPosition {
  let positionId = user + market; // user + market tokenID
  let position = MarketPosition.load(positionId);
  if (position == null) {
    position = new MarketPosition(positionId);
    position.market = market;
    position.user = user;
    position.quantityBought = bigZero;
    position.quantitySold = bigZero;
    position.netQuantity = bigZero;
    position.valueBought = bigZero;
    position.valueSold = bigZero;
    position.netValue = bigZero;
    position.feesPaid = bigZero;
  }
  return position as MarketPosition;
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
 */
export function updateMarketPositionFromOrderFilled(
  maker: string,
  tokenId: string,
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
  let mktData = MarketData.load(tokenId);
  if (mktData != null) {
    updateUserProfit(
      maker,
      profit,
      collateralScaleDec,
      event.block.timestamp,
      mktData.condition,
    );
  }
  updateNetPositionAndSave(position);
}

export function updateMarketPositionFromTrade(event: ethereum.Event): void {
  let transaction = Transaction.load(event.transaction.hash.toHexString());
  if (transaction == null) {
    log.error('Could not find a transaction with hash: {}', [
      event.transaction.hash.toString(),
    ]);
    throw new Error(
      `Could not find transaction with hash: ${event.transaction.hash.toString()}`,
    );
  }

  const fpmm = FixedProductMarketMaker.load(
    transaction.market,
  ) as FixedProductMarketMaker;

  const conditionalTokenAddress = fpmm.conditionalTokenAddress;
  const conditions = fpmm.conditions;
  const collateralToken = fpmm.collateralToken.toString();
  const outcomeSlotCount = fpmm.outcomeSlotCount as number;
  const collateralScale = getCollateralScale(fpmm.collateralToken);
  const collateralScaleDec = collateralScale.toBigDecimal();

  if (conditions == null || conditions.length == 0) {
    log.error('LOG: Could not find conditions on the FPMM: {}', [
      transaction.market,
    ]);
    throw new Error(
      `ERR: Could not find conditions on the FPMM: ${transaction.market.toString()}`,
    );
  }

  // Calculate the market/tokenId from the conditionId and the outcome index
  // Note: this assumes a single conditionId and a zero parentCollectionId
  let condition = conditions[0];
  const market = getMarket(
    conditionalTokenAddress,
    condition,
    collateralToken,
    outcomeSlotCount,
    transaction.outcomeIndex.toI32(),
  );

  let position = getMarketPosition(transaction.user, market);

  let fee = fpmm.fee;
  // express the fee in terms of cash
  let feeAmount = bigZero;
  let profit = transaction.tradeAmount;

  if (transaction.type == TRADE_TYPE_BUY) {
    position.quantityBought = position.quantityBought.plus(
      transaction.outcomeTokensAmount,
    );
    position.valueBought = position.valueBought.plus(transaction.tradeAmount);

    // feeAmount = investmentAmount * fee
    feeAmount = transaction.tradeAmount
      .times(fee)
      .div(BigInt.fromI32(10).pow(18));
    position.feesPaid = position.feesPaid.plus(feeAmount);
    // if buy, profit is negative
    profit = profit.neg();
  } else {
    position.quantitySold = position.quantitySold.plus(
      transaction.outcomeTokensAmount,
    );
    position.valueSold = position.valueSold.plus(transaction.tradeAmount);

    // feeAmount = returnAmount * (fee/(1-fee));
    feeAmount = transaction.tradeAmount
      .times(fee)
      .div(BigInt.fromI32(10).pow(18).minus(fee));
    position.feesPaid = position.feesPaid.plus(feeAmount);
  }

  updateUserProfit(
    transaction.user,
    profit,
    collateralScaleDec,
    transaction.timestamp,
    condition,
  );

  updateNetPositionAndSave(position);
}

/*
 * Updates a user's market position after manually splitting collateral
 *
 * WARNING: This is only valid for markets which have a single condition
 * It assumes that the number of outcome slots on the market maker is equal to that on the condition
 */
export function updateMarketPositionsFromSplit(
  marketMakerAddress: string,
  event: PositionSplit,
): void {
  let userAddress = event.params.stakeholder.toHexString();
  let marketMaker = FixedProductMarketMaker.load(
    marketMakerAddress,
  ) as FixedProductMarketMaker;
  let outcomeTokenPrices = marketMaker.outcomeTokenPrices;
  const conditionalTokenAddress = marketMaker.conditionalTokenAddress;
  const conditions = marketMaker.conditions;
  const collateralToken = marketMaker.collateralToken.toString();
  const outcomeSlotCount = marketMaker.outcomeSlotCount as number;

  if (conditions == null || conditions.length == 0) {
    log.error('LOG: Could not find conditions on the FPMM: {}', [
      marketMakerAddress,
    ]);
    throw new Error(
      `ERR: Could not find conditions on the FPMM: ${marketMakerAddress}`,
    );
  }

  for (
    let outcomeIndex = 0;
    outcomeIndex < outcomeTokenPrices.length;
    outcomeIndex += 1
  ) {
    let condition = conditions[0];
    const market = getMarket(
      conditionalTokenAddress,
      condition,
      collateralToken,
      outcomeSlotCount,
      outcomeIndex,
    );
    let position = getMarketPosition(userAddress, market);
    // Event emits the amount of collateral to be split as `amount`
    position.quantityBought = position.quantityBought.plus(event.params.amount);

    // Distribute split value proportionately based on share value(according to the FPMM)
    let splitValue = timesBD(
      event.params.amount,
      outcomeTokenPrices[outcomeIndex],
    );
    position.valueBought = position.valueBought.plus(splitValue);
    updateNetPositionAndSave(position);
  }
}

/*
 * Updates a user's market position after a merge
 *
 * WARNING: This is only valid for markets which have a single condition
 * It assumes that the number of outcome slots on the market maker is equal to that on the condition
 */
export function updateMarketPositionsFromMerge(
  marketMakerAddress: string,
  event: PositionsMerge,
): void {
  let userAddress = event.params.stakeholder.toHexString();
  let marketMaker = FixedProductMarketMaker.load(
    marketMakerAddress,
  ) as FixedProductMarketMaker;

  let outcomeTokenPrices = marketMaker.outcomeTokenPrices;
  const conditionalTokenAddress = marketMaker.conditionalTokenAddress;
  const conditions = marketMaker.conditions;
  const collateralToken = marketMaker.collateralToken.toString();
  const outcomeSlotCount = marketMaker.outcomeSlotCount as number;

  const collateralScale = getCollateralScale(marketMaker.collateralToken);
  const collateralScaleDec = collateralScale.toBigDecimal();

  // profit calculation = (1 - sum of avg price buy price per outcome) * amount
  let sumOfAvgBuyPrice = bigZero;

  if (conditions == null || conditions.length == 0) {
    log.error('LOG: Could not find conditions on the FPMM: {}', [
      marketMakerAddress,
    ]);
    throw new Error(
      `ERR: Could not find conditions on the FPMM: ${marketMakerAddress}`,
    );
  }
  const condition = conditions[0];

  for (
    let outcomeIndex = 0;
    outcomeIndex < outcomeTokenPrices.length;
    outcomeIndex += 1
  ) {
    const market = getMarket(
      conditionalTokenAddress,
      condition,
      collateralToken,
      outcomeSlotCount,
      outcomeIndex,
    );

    let position = getMarketPosition(userAddress, market);
    // Event emits the amount of outcome tokens to be merged as `amount`
    position.quantitySold = position.quantitySold.plus(event.params.amount);

    // Distribute merge value proportionately based on share value
    let mergeValue = timesBD(
      event.params.amount,
      outcomeTokenPrices[outcomeIndex],
    );
    position.valueSold = position.valueSold.plus(mergeValue);

    // Calculate profit
    if (!(position.valueBought.isZero() || position.quantityBought.isZero())) {
      // Use valueBought and quantityBought to calculate average buy price
      // as netValue includes sells and therefore can be negative
      // sumOfAvgPricesPaid = sumOfAvgPricesPaid.plus(
      //   position.netValue.div(position.netQuantity),
      sumOfAvgBuyPrice = sumOfAvgBuyPrice.plus(
        position.valueBought.div(position.quantityBought),
      );
    }
    updateNetPositionAndSave(position);
  }

  // Calculate pnl
  if (!sumOfAvgBuyPrice.isZero()) {
    let profit = bigOne.minus(sumOfAvgBuyPrice).times(event.params.amount);
    updateUserProfit(
      userAddress,
      profit,
      collateralScaleDec,
      event.block.timestamp,
      condition,
    );
  }
}

/*
 * Updates a user's market position after redeeming a position
 *
 * WARNING: This is only valid for markets which have a single condition
 * It assumes that the number of outcome slots on the market maker is equal to that on the condition
 */
export function updateMarketPositionsFromRedemption(
  marketMakerAddress: string,
  event: PayoutRedemption,
): void {
  let redeemer = event.params.redeemer.toHexString();
  let conditionId = event.params.conditionId.toHexString();
  let condition = Condition.load(conditionId) as Condition;
  let marketMaker = FixedProductMarketMaker.load(
    marketMakerAddress,
  ) as FixedProductMarketMaker;

  const conditionalTokenAddress = marketMaker.conditionalTokenAddress;
  const conditions = marketMaker.conditions;
  const collateralToken = marketMaker.collateralToken.toString();
  const collateralScaleDec = getCollateralScale(
    marketMaker.collateralToken,
  ).toBigDecimal();

  const outcomeSlotCount = marketMaker.outcomeSlotCount as number;

  if (conditions == null || conditions.length == 0) {
    log.error('LOG: Could not find conditions on the FPMM: {}', [
      marketMakerAddress,
    ]);
    throw new Error(
      `ERR: Could not find conditions on the FPMM: ${marketMakerAddress}`,
    );
  }

  let payoutNumerators = condition.payoutNumerators as BigInt[];
  let payoutDenominator = condition.payoutDenominator as BigInt;

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
    const market = getMarket(
      conditionalTokenAddress,
      conditionId,
      collateralToken,
      outcomeSlotCount,
      outcomeIndex,
    );

    let position = getMarketPosition(redeemer, market);

    // Redeeming a position is an all or nothing operation so use full balance for calculations
    let numerator = payoutNumerators[outcomeIndex];
    let redemptionValue = position.netQuantity
      .times(numerator)
      .div(payoutDenominator);

    updateUserProfit(
      redeemer,
      redemptionValue,
      collateralScaleDec,
      event.block.timestamp,
      conditionId,
    );

    // position gets zero'd out
    position.quantitySold = position.quantitySold.plus(position.netQuantity);
    position.valueSold = position.valueSold.plus(redemptionValue);
    updateNetPositionAndSave(position);
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

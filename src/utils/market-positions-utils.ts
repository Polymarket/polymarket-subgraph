/* eslint-disable no-param-reassign */
import { BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import {
  FixedProductMarketMaker,
  MarketPosition,
  Transaction,
  Condition
} from "../types/schema";
import {
  PositionsMerge,
  PositionSplit,
  PayoutRedemption
} from "../types/ConditionalTokens/ConditionalTokens";
import {
  FPMMFundingAdded,
  FPMMFundingRemoved,
  FPMMSell
} from "../types/templates/FixedProductMarketMaker/FixedProductMarketMaker";
import { ADD_FUNDING, bigZero, REMOVE_FUNDING, bigOne } from "./constants";
import { max, timesBD } from "./maths";
import { updateGlobalLiquidity } from "./global-utils";
import { getCollateralScale } from "./collateralTokens";
import { updateUserProfit } from "./account-utils";

/*
 * Returns the user's position for the given market and outcome
 * If no such position exists then a null position is generated
 */
export function getMarketPosition(
  user: string,
  market: string,
  outcomeIndex: BigInt
): MarketPosition {
  let positionId = user + market + outcomeIndex.toString();
  let position = MarketPosition.load(positionId);
  if (position == null) {
    position = new MarketPosition(positionId);
    position.market = market;
    position.user = user;
    position.outcomeIndex = outcomeIndex;
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
      "Invalid position: user {} has negative netQuantity on outcome {} on market {}",
      [position.user, position.outcomeIndex.toString(), position.market]
    );
  }

  position.save();
}

export function updateMarketPositionFromTrade(event: ethereum.Event): void {
  let transaction = Transaction.load(event.transaction.hash.toHexString());
  if (transaction == null) {
    log.error("Could not find a transaction with hash: {}", [
      event.transaction.hash.toString()
    ]);
    throw new Error("Could not find transaction with hash");
  }

  let position = getMarketPosition(
    transaction.user,
    transaction.market,
    transaction.outcomeIndex
  );
  let fpmm = FixedProductMarketMaker.load(
    transaction.market
  ) as FixedProductMarketMaker;
  let fee = fpmm.fee;
  let collateralScale = getCollateralScale(fpmm.collateralToken);
  let collateralScaleDec = collateralScale.toBigDecimal();

  if (transaction.type == "Buy") {
    position.quantityBought = position.quantityBought.plus(
      transaction.outcomeTokensAmount
    );
    position.valueBought = position.valueBought.plus(transaction.tradeAmount);

    // feeAmount = investmentAmount * fee
    let feeAmount = transaction.tradeAmount
      .times(fee)
      .div(BigInt.fromI32(10).pow(18));
    position.feesPaid = position.feesPaid.plus(feeAmount);
  } else {
    position.quantitySold = position.quantitySold.plus(
      transaction.outcomeTokensAmount
    );
    position.valueSold = position.valueSold.plus(transaction.tradeAmount);
    // ignore zero share sells at block 4518199
    //    to avoid impact of this transaction which blocks subgraph syncing (0 share sell)
    //    https://polygonscan.com/tx/0x86995a4d8e240dfa604fbc58e501560b90d1aeeb6e1be67d87e091bfde5cf116
    // also ignore zero net quantity causing error at block 9311227
    //    https://polygonscan.com/tx/0x0595ed8cf4aad8946b6fc27d31a81b8047462624318619e0db7a09ec4cdbdab8
    if (
      (event as FPMMSell).params.outcomeTokensSold.gt(bigZero) &&
      position.netQuantity.gt(bigZero)
    ) {
      let averageSellPrice = (event as FPMMSell).params.returnAmount.div(
        (event as FPMMSell).params.outcomeTokensSold
      );
      let averagePricePaid = position.netValue.div(position.netQuantity);

      let pnl = averageSellPrice
        .minus(averagePricePaid)
        .times((event as FPMMSell).params.outcomeTokensSold)
        .minus((event as FPMMSell).params.feeAmount);
      updateUserProfit(
        transaction.user,
        pnl,
        collateralScaleDec,
        transaction.timestamp,
        transaction.market
      );
    }

    // feeAmount = returnAmount * (fee/(1-fee));
    let feeAmount = transaction.tradeAmount
      .times(fee)
      .div(BigInt.fromI32(10).pow(18).minus(fee));
    position.feesPaid = position.feesPaid.plus(feeAmount);
  }

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
  event: PositionSplit
): void {
  let userAddress = event.params.stakeholder.toHexString();
  let marketMaker = FixedProductMarketMaker.load(
    marketMakerAddress
  ) as FixedProductMarketMaker;
  let outcomeTokenPrices = marketMaker.outcomeTokenPrices;

  for (
    let outcomeIndex = 0;
    outcomeIndex < outcomeTokenPrices.length;
    outcomeIndex += 1
  ) {
    let position = getMarketPosition(
      userAddress,
      marketMakerAddress,
      BigInt.fromI32(outcomeIndex)
    );
    // Event emits the amount of collateral to be split as `amount`
    position.quantityBought = position.quantityBought.plus(event.params.amount);

    // Distribute split value proportionately based on share value
    let splitValue = timesBD(
      event.params.amount,
      outcomeTokenPrices[outcomeIndex]
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
  event: PositionsMerge
): void {
  let userAddress = event.params.stakeholder.toHexString();
  let marketMaker = FixedProductMarketMaker.load(
    marketMakerAddress
  ) as FixedProductMarketMaker;
  let outcomeTokenPrices = marketMaker.outcomeTokenPrices;
  let collateralScale = getCollateralScale(marketMaker.collateralToken);
  let collateralScaleDec = collateralScale.toBigDecimal();

  // profit calculation = (1 - sum of avg price paid per outcome) * amount
  let sumOfAvgPricesPaid = bigZero;

  for (
    let outcomeIndex = 0;
    outcomeIndex < outcomeTokenPrices.length;
    outcomeIndex += 1
  ) {
    let position = getMarketPosition(
      userAddress,
      marketMakerAddress,
      BigInt.fromI32(outcomeIndex)
    );
    // Event emits the amount of outcome tokens to be merged as `amount`
    position.quantitySold = position.quantitySold.plus(event.params.amount);

    // Distribute merge value proportionately based on share value
    let mergeValue = timesBD(
      event.params.amount,
      outcomeTokenPrices[outcomeIndex]
    );
    position.valueSold = position.valueSold.plus(mergeValue);

    // profit calculation only if netQuantity.gt(bigZero)
    // this avoids a divide by zero error from this transaction
    // https://polygonscan.com/tx/0xc6ab0ce453b64cfb2224e33df8b14a9f662532edf893a366f7c76093c8fb057b
    // and this 0 value merge
    // https://polygonscan.com/tx/0xa2b00d6ef6e85735f4463e7644c298d86d5d4085f21692e4b7c70dee67d04ee7
    if (position.netQuantity.gt(bigZero) && event.params.amount.gt(bigZero)) {
      let averagePricePaid = position.netValue.div(position.netQuantity);
      let currentPrice = mergeValue.div(event.params.amount); // keep this in BigInt instead of using outcomeTokenPrices[outcomeIndex] which is BigDecimal
      let pnl = currentPrice.minus(averagePricePaid).times(event.params.amount);
      log.info("averagePricePaid: {} | currentPrice: {} | pnl: {}", [averagePricePaid.toString(), currentPrice.toString(), pnl.toString()]);
      updateUserProfit(
        userAddress,
        pnl,
        collateralScaleDec,
        event.block.timestamp,
        marketMakerAddress
      );
    }
    updateNetPositionAndSave(position);
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
  event: PayoutRedemption
): void {
  let userAddress = event.params.redeemer.toHexString();
  let condition = Condition.load(
    event.params.conditionId.toHexString()
  ) as Condition;

  let payoutNumerators = condition.payoutNumerators as BigInt[];
  let payoutDenominator = condition.payoutDenominator as BigInt;

  if (payoutNumerators == null || payoutDenominator == null) {
    log.error(
      "Failed to update market positions: condition {} has not resolved",
      [condition.id]
    );
    return;
  }

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

    let position = getMarketPosition(
      userAddress,
      marketMakerAddress,
      BigInt.fromI32(outcomeIndex)
    );

    // Redeeming a position is an all or nothing operation so use full balance for calculations
    let numerator = payoutNumerators[outcomeIndex];
    let redemptionValue = position.netQuantity
      .times(numerator)
      .div(payoutDenominator);

    // position gets zero'd out
    position.quantitySold = position.quantitySold.plus(position.netQuantity);
    position.valueSold = position.valueSold.plus(redemptionValue);

    updateNetPositionAndSave(position);
  }
}

export function updateMarketPositionFromLiquidityAdded(
  event: FPMMFundingAdded
): void {
  let fpmmAddress = event.address.toHexString();
  let funder = event.params.funder.toHexString();
  let amountsAdded = event.params.amountsAdded;

  // The amounts of outcome token are limited by the cheapest outcome.
  // This will have the full balance added to the market maker
  // therefore this is the amount of collateral that the user has split.
  let addedFunds = max(amountsAdded);

  let fpmm = FixedProductMarketMaker.load(
    fpmmAddress
  ) as FixedProductMarketMaker;

  let outcomeTokenPrices = fpmm.outcomeTokenPrices;
  let collateralScale = getCollateralScale(fpmm.collateralToken);
  let collateralScaleDec = collateralScale.toBigDecimal();
  updateGlobalLiquidity(addedFunds, collateralScaleDec, ADD_FUNDING);

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
      // Only update positions which have changed
      let position = getMarketPosition(
        funder,
        fpmmAddress,
        BigInt.fromI32(outcomeIndex)
      );

      position.quantityBought = position.quantityBought.plus(refundedAmount);

      let refundValue = timesBD(
        refundedAmount,
        outcomeTokenPrices[outcomeIndex]
      );
      position.valueBought = position.valueBought.plus(refundValue);

      updateNetPositionAndSave(position);
    }
  }
}

export function updateMarketPositionFromLiquidityRemoved(
  event: FPMMFundingRemoved
): void {
  let fpmmAddress = event.address.toHexString();
  let funder = event.params.funder.toHexString();
  let amountsRemoved = event.params.amountsRemoved;
  let fpmm = FixedProductMarketMaker.load(
    fpmmAddress
  ) as FixedProductMarketMaker;

  let outcomeTokenPrices = fpmm.outcomeTokenPrices;
  let collateralScale = getCollateralScale(fpmm.collateralToken);
  let collateralScaleDec = collateralScale.toBigDecimal();
  // The funder is sent all of the outcome tokens for which they were providing liquidity
  // This means we must update the funder's market position for each outcome.
  for (
    let outcomeIndex = 0;
    outcomeIndex < amountsRemoved.length;
    outcomeIndex += 1
  ) {
    let position = getMarketPosition(
      funder,
      fpmmAddress,
      BigInt.fromI32(outcomeIndex)
    );

    let amountRemoved = amountsRemoved[outcomeIndex];
    position.quantityBought = position.quantityBought.plus(amountRemoved);

    let removedValue = timesBD(amountRemoved, outcomeTokenPrices[outcomeIndex]);
    position.valueBought = position.valueBought.plus(removedValue);

    updateNetPositionAndSave(position);
    updateGlobalLiquidity(removedValue, collateralScaleDec, REMOVE_FUNDING);
  }
}

import { BigInt, log } from '@graphprotocol/graph-ts';

import { updateUserPositionWithBuy } from './utils/updateUserPositionWithBuy';
import { updateUserPositionWithSell } from './utils/updateUserPositionWithSell';
import {
  PositionSplit,
  PositionsMerge,
  PositionsConverted,
  MarketPrepared,
  QuestionPrepared,
  PayoutRedemption,
} from './types/NegRiskAdapter/NegRiskAdapter';
import { NegRiskEvent } from './types/schema';
import { loadCondition } from './utils/loadCondition';

import { getNegRiskPositionId } from '../../common';
import {
  COLLATERAL_SCALE,
  FIFTY_CENTS,
  NEG_RISK_EXCHANGE,
} from '../../common/constants';
import { loadOrCreateUserPosition } from './utils/loadOrCreateUserPosition';
import { indexSetContains } from '../../common/utils/indexSetContains';
import { computeNegRiskYesPrice } from './utils/computeNegRiskYesPrice';

// @ts-expect-error Cannot find name 'u8'.
const YES_INDEX: u8 = 0;
// @ts-expect-error Cannot find name 'u8'.
const NO_INDEX: u8 = 1;

// SPLIT
export function handlePositionSplit(event: PositionSplit): void {
  const conditionId = event.params.conditionId;
  const condition = loadCondition(conditionId);
  if (condition == null) {
    // ignore
    return;
  }

  // - don't track splits from the NegRiskExchange
  if (
    [NEG_RISK_EXCHANGE.toHexString()].includes(
      event.params.stakeholder.toHexString(),
    )
  ) {
    return;
  }

  // @ts-expect-error Cannot find name 'u8'.
  let outcomeIndex: u8 = 0;
  for (; outcomeIndex < 2; outcomeIndex++) {
    const positionId = condition.positionIds[outcomeIndex];

    updateUserPositionWithBuy(
      event.params.stakeholder,
      positionId,
      FIFTY_CENTS,
      event.params.amount,
    );
  }
}

// MERGE
export function handlePositionsMerge(event: PositionsMerge): void {
  const conditionId = event.params.conditionId;
  const condition = loadCondition(conditionId);
  if (condition == null) {
    // ignore
    return;
  }

  // - don't track merges from the NegRiskExchange
  if (
    [NEG_RISK_EXCHANGE.toHexString()].includes(
      event.params.stakeholder.toHexString(),
    )
  ) {
    return;
  }

  // @ts-expect-error Cannot find name 'u8'.
  let outcomeIndex: u8 = 0;
  for (; outcomeIndex < 2; outcomeIndex++) {
    const positionId = condition.positionIds[outcomeIndex];

    updateUserPositionWithSell(
      event.params.stakeholder,
      positionId,
      FIFTY_CENTS,
      event.params.amount,
    );
  }
}

// CONVERT
export function handlePositionsConverted(event: PositionsConverted): void {
  const negRiskEvent = NegRiskEvent.load(event.params.marketId.toHexString());
  if (negRiskEvent == null) {
    // ignore
    return;
  }

  // @ts-expect-error Cannot find name 'u32'.
  const questionCount = <u32>negRiskEvent.questionCount;
  const indexSet = event.params.indexSet;

  // 1. NO_PRICE is obtained as the average of the NO token average prices
  // @ts-expect-error Cannot find name 'u8'.
  let questionIndex: u8 = 0;
  let noCount = 0;
  let noPriceSum = BigInt.zero();

  // get the average NO price
  for (; questionIndex < questionCount; questionIndex++) {
    //
    // check if indexSet AND (1 << questionIndex) > 0
    // if so, then the user is converting NO tokens
    // otherwise,
    //
    if (indexSetContains(indexSet, questionIndex)) {
      // if the indexSet contains this index
      // then the user sells NO tokens
      noCount++;

      const positionId = getNegRiskPositionId(
        event.params.marketId,
        questionIndex,
        NO_INDEX,
      );

      const userPosition = loadOrCreateUserPosition(
        event.params.stakeholder,
        positionId,
      );

      // sell the NO token for the average price it was obtained for
      updateUserPositionWithSell(
        event.params.stakeholder,
        positionId,
        userPosition.avgPrice,
        event.params.amount,
      );

      noPriceSum = noPriceSum.plus(userPosition.avgPrice);
    }
  }

  const noPrice = noPriceSum.div(BigInt.fromI32(noCount));

  // questionCount could equal noCount,
  // in that case we didn't buy any YES tokens
  if (questionCount == noCount) {
    return;
  }

  const yesPrice = computeNegRiskYesPrice(noPrice, noCount, questionCount);

  questionIndex = 0;
  for (; questionIndex < questionCount; questionIndex++) {
    if (!indexSetContains(indexSet, questionIndex)) {
      // if the index set does NOT contain this index
      // then the user buys YES tokens
      const positionId = getNegRiskPositionId(
        event.params.marketId,
        questionIndex,
        YES_INDEX,
      );
      // buy the YES tokens with average YES price computed above
      updateUserPositionWithBuy(
        event.params.stakeholder,
        positionId,
        yesPrice,
        event.params.amount,
      );
    }
  }
}

// REDEEM
export function handlePayoutRedemption(event: PayoutRedemption): void {
  const conditionId = event.params.conditionId;
  const condition = loadCondition(conditionId);
  if (condition == null) {
    // ignore
    return;
  }

  if (condition.payoutDenominator == BigInt.zero()) {
    log.error('Failed to update market positions: payoutDenominator is 0', []);
    return;
  }

  const payoutNumerators = condition.payoutNumerators;
  const payoutDenominator = condition.payoutDenominator;

  // @ts-expect-error Cannot find name 'u8'.
  let outcomeIndex: u8 = 0;
  for (; outcomeIndex < 2; outcomeIndex++) {
    const positionId = condition.positionIds[outcomeIndex];

    const amount = event.params.amounts[outcomeIndex];
    const price = payoutNumerators[outcomeIndex]
      .times(COLLATERAL_SCALE)
      .div(payoutDenominator);
    updateUserPositionWithSell(
      event.params.redeemer,
      positionId,
      price,
      amount,
    );
  }
}

// MARKET PREPARED
export function handleMarketPrepared(event: MarketPrepared): void {
  const negRiskEvent = new NegRiskEvent(event.params.marketId.toHexString());
  negRiskEvent.questionCount = 0;
  negRiskEvent.save();
}

// QUESTION PREPARED
export function handleQuestionPrepared(event: QuestionPrepared): void {
  const negRiskEvent = NegRiskEvent.load(event.params.marketId.toHexString());
  if (negRiskEvent == null) {
    return;
  }

  negRiskEvent.questionCount += 1;
  negRiskEvent.save();
}

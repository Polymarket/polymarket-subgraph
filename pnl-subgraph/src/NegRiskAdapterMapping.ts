import { BigInt, log } from '@graphprotocol/graph-ts';

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
import { updateUserPositionWithBuy } from './utils/updateUserPositionWithBuy';
import { updateUserPositionWithSell } from './utils/updateUserPositionWithSell';

import { getNegRiskPositionId } from '../../common';
import {
  COLLATERAL_SCALE,
  FIFTY_CENTS,
  NEG_RISK_EXCHANGE,
} from '../../common/constants';
import { indexSetContains } from '../../common/utils/indexSetContains';

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

  // @ts-expect-error Cannot find name 'u8'.
  const questionCount = <u8>negRiskEvent.questionCount;
  const indexSet = event.params.indexSet;

  // 1/N
  const yesTokenPrice = COLLATERAL_SCALE.div(BigInt.fromI32(questionCount));
  // (N-1)/N
  const noTokenPrice = yesTokenPrice.times(BigInt.fromI32(questionCount - 1));

  for (
    // @ts-expect-error Cannot find name 'u8'.
    let questionIndex: u8 = 0;
    questionIndex < questionCount;
    questionIndex++
  ) {
    if (indexSetContains(indexSet, questionIndex)) {
      // if the indexSet contains this index
      // and the user sells NO tokens
      const positionId = getNegRiskPositionId(
        event.params.marketId,
        questionIndex,
        NO_INDEX,
      );

      updateUserPositionWithSell(
        event.params.stakeholder,
        positionId,
        noTokenPrice,
        event.params.amount,
      );
    } else {
      // the indexSet does not contain this index
      // and the user buys YES tokens
      const positionId = getNegRiskPositionId(
        event.params.marketId,
        questionIndex,
        YES_INDEX,
      );

      updateUserPositionWithBuy(
        event.params.stakeholder,
        positionId,
        yesTokenPrice,
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

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

import { computePositionId, getNegRiskPositionId } from '../../common';
import {
  COLLATERAL_SCALE,
  NEG_RISK_EXCHANGE,
  NEG_RISK_OPERATOR,
  NEG_RISK_WRAPPED_COLLATERAL,
} from '../../common/constants';
import { loadCondition } from './utils/loadCondition';

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

  const BUY_PRICE = COLLATERAL_SCALE.div(BigInt.fromI32(2));

  // @ts-expect-error Cannot find name 'u8'.
  let outcomeIndex: u8 = 0;
  for (; outcomeIndex < 2; outcomeIndex++) {
    const positionId = computePositionId(
      NEG_RISK_WRAPPED_COLLATERAL,
      event.params.conditionId,
      outcomeIndex,
    );
    updateUserPositionWithBuy(
      event.params.stakeholder,
      positionId,
      BUY_PRICE,
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

  const SELL_PRICE = COLLATERAL_SCALE.div(BigInt.fromI32(2));

  // @ts-expect-error Cannot find name 'u8'.
  let outcomeIndex: u8 = 0;
  for (; outcomeIndex < 2; outcomeIndex++) {
    const positionId = computePositionId(
      NEG_RISK_WRAPPED_COLLATERAL,
      event.params.conditionId,
      outcomeIndex,
    );
    updateUserPositionWithSell(
      event.params.stakeholder,
      positionId,
      SELL_PRICE,
      event.params.amount,
    );
  }
}

// CONVERT
export function handlePositionsConverted(event: PositionsConverted): void {
  const negRiskEvent = NegRiskEvent.load(event.params.marketId.toHexString());
  if (negRiskEvent === null) {
    // ignore
    return;
  }

  // @ts-expect-error Cannot find name 'u8'.
  const questionCount = <u32>negRiskEvent.questionCount;
  const YES_PRICE = COLLATERAL_SCALE.div(BigInt.fromI32(questionCount));
  const NO_PRICE = COLLATERAL_SCALE.minus(YES_PRICE);
  // @ts-expect-error Cannot find name 'u8'.
  const YES_INDEX: u8 = 0;
  // @ts-expect-error Cannot find name 'u8'.
  const NO_INDEX: u8 = 1;

  const indexSet = event.params.indexSet;

  // @ts-expect-error Cannot find name 'u8'.
  let questionIndex: u8 = 0;
  for (; questionIndex < questionCount; questionIndex++) {
    if (
      indexSet
        .bitAnd(BigInt.fromI32(1).leftShift(questionIndex))
        .gt(BigInt.zero())
    ) {
      // if the indexSet contains this index
      // then the user sells NO tokens

      const positionId = getNegRiskPositionId(
        event.params.marketId,
        questionIndex,
        NO_INDEX,
      );
      updateUserPositionWithSell(
        event.params.stakeholder,
        positionId,
        NO_PRICE,
        event.params.amount,
      );
    } else {
      // if the index set does NOT contain this index
      // then the user buys YES tokens
      const positionId = getNegRiskPositionId(
        event.params.marketId,
        questionIndex,
        YES_INDEX,
      );
      updateUserPositionWithBuy(
        event.params.stakeholder,
        positionId,
        YES_PRICE,
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
    const positionId = computePositionId(
      NEG_RISK_WRAPPED_COLLATERAL,
      conditionId,
      outcomeIndex,
    );

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
  // ignore non-negRiskOperator events
  if (NEG_RISK_OPERATOR.toHexString() !== event.params.oracle.toHexString()) {
    return;
  }

  const negRiskEvent = new NegRiskEvent(event.params.marketId.toHexString());
  negRiskEvent.questionCount = 0;
  negRiskEvent.save();
}

// QUESTION PREPARED
export function handleQuestionPrepared(event: QuestionPrepared): void {
  const negRiskEvent = NegRiskEvent.load(event.params.marketId.toHexString());
  if (negRiskEvent === null) {
    // ignore non-negRiskOperator events
    return;
  }

  negRiskEvent.questionCount += 1;
  negRiskEvent.save();
}

import { BigInt } from '@graphprotocol/graph-ts';

import {
  PositionSplit,
  PositionsMerge,
  PositionsConverted,
  MarketPrepared,
  QuestionPrepared,
  PayoutRedemption,
} from './types/NegRiskAdapter/NegRiskAdapter';
import { NegRiskEvent } from './types/schema';
import { computePositionId } from './utils/ctf-utils';

import {
  COLLATERAL_SCALE,
  NEG_RISK_EXCHANGE,
  NEG_RISK_OPERATOR,
  NEG_RISK_WRAPPED_COLLATERAL,
} from './constants';

import { getNegRiskPositionId } from './utils/getNegRiskPositionId';
import { updateUserPositionWithBuy } from './utils/updateUserPositionWithBuy';
import { updateUserPositionWithSell } from './utils/updateUserPositionWithSell';

// SPLIT
export function handlePositionSplit(event: PositionSplit): void {
  // - don't track splits from the NegRiskExchange
  if (
    [NEG_RISK_EXCHANGE.toHexString()].includes(
      event.params.stakeholder.toHexString(),
    )
  ) {
    return;
  }

  const SELL_PRICE = COLLATERAL_SCALE.div(BigInt.fromI32(2));
  for (let outcomeIndex = 0; outcomeIndex < 2; outcomeIndex++) {
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

// MERGE
export function handlePositionsMerge(event: PositionsMerge): void {
  // - don't track merges from the NegRiskExchange
  if (
    [NEG_RISK_EXCHANGE.toHexString()].includes(
      event.params.stakeholder.toHexString(),
    )
  ) {
    return;
  }

  const BUY_PRICE = COLLATERAL_SCALE.div(BigInt.fromI32(2));
  for (let outcomeIndex = 0; outcomeIndex < 2; outcomeIndex++) {
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

export function handlePositionsConverted(event: PositionsConverted): void {
  const negRiskEvent = NegRiskEvent.load(event.params.marketId.toHexString());

  if (negRiskEvent === null) {
    return;
  }

  const questionCount = negRiskEvent.questionCount;
  const YES_PRICE = COLLATERAL_SCALE.div(BigInt.fromI32(questionCount));
  const NO_PRICE = COLLATERAL_SCALE.minus(YES_PRICE);
  const YES_INDEX = 0;
  const NO_INDEX = 1;

  const indexSet = event.params.indexSet;
  // let indexSetSize = 0;
  for (let questionIndex = 0; questionIndex < questionCount; questionIndex++) {
    indexSet
      .bitAnd(BigInt.fromI32(1).leftShift(questionIndex))
      .gt(BigInt.zero());

    if (indexSet.bitAnd(BigInt.fromI32(1)).gt(BigInt.zero())) {
      // if the indexSet contains this index
      // then the user spends NO tokens

      const positionId = getNegRiskPositionId(
        event.params.marketId,
        questionIndex,
        NO_INDEX,
      );
      updateUserPositionWithBuy(
        event.params.stakeholder,
        positionId,
        NO_PRICE,
        event.params.amount,
      );
    } else {
      // if the index set does NOT contain this index
      // then the user receives YES tokens
      const positionId = getNegRiskPositionId(
        event.params.marketId,
        questionIndex,
        YES_INDEX,
      );
      updateUserPositionWithSell(
        event.params.stakeholder,
        positionId,
        YES_PRICE,
        event.params.amount,
      );
    }
  }
}

// need to track payouts from the CTF
export function handlePayoutRedemption(event: PayoutRedemption): void {
  requireAccount(event.params.redeemer.toHexString(), event.block.timestamp);
  markAccountAsSeen(event.params.redeemer.toHexString(), event.block.timestamp);

  let redemption = new Redemption(getEventKey(event));

  redemption.timestamp = event.block.timestamp;
  redemption.redeemer = event.params.redeemer.toHexString();
  redemption.collateralToken = USDC;
  redemption.parentCollectionId = Bytes.fromI32(0);
  redemption.condition = event.params.conditionId.toHexString();
  redemption.indexSets = [BigInt.fromI32(1), BigInt.fromI32(2)];
  redemption.payout = event.params.payout;

  redemption.save();

  const negRisk = true;
  updateMarketPositionsFromRedemption(
    event.params.conditionId,
    event.params.redeemer,
    [BigInt.fromI32(1), BigInt.fromI32(2)],
    event.block.timestamp,
    negRisk,
    event.params.amounts,
  );
}

export function handleMarketPrepared(event: MarketPrepared): void {
  // ignore non-negRiskOperator events
  if (event.params.oracle.toHexString() !== NEG_RISK_OPERATOR) {
    return;
  }

  let negRiskEvent = new NegRiskEvent(event.params.marketId.toHexString());
  negRiskEvent.questionCount = 0;
  negRiskEvent.save();
}

export function handleQuestionPrepared(event: QuestionPrepared): void {
  let negRiskEvent = NegRiskEvent.load(event.params.marketId.toHexString());

  // ignore non-negRiskOperator events
  if (negRiskEvent === null) {
    return;
  }

  negRiskEvent.questionCount += 1;
  negRiskEvent.save();
}

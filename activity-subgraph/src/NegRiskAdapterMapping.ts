import { BigInt } from '@graphprotocol/graph-ts';

import {
  PositionSplit,
  PositionsMerge,
  PositionsConverted,
  MarketPrepared,
  QuestionPrepared,
  PayoutRedemption,
} from './types/NegRiskAdapter/NegRiskAdapter';
import {
  Merge,
  Split,
  Redemption,
  NegRiskConversion,
  NegRiskEvent,
} from './types/schema';
import { getEventKey } from '../../common/utils/getEventKey';
import { NEG_RISK_EXCHANGE } from '../../common/constants';

export function handlePositionSplit(event: PositionSplit): void {
  // - don't track splits from the NegRiskExchange
  if (
    [NEG_RISK_EXCHANGE.toHexString()].includes(
      event.params.stakeholder.toHexString(),
    )
  ) {
    return;
  }

  const split = new Split(getEventKey(event));
  split.timestamp = event.block.timestamp;
  split.stakeholder = event.params.stakeholder.toHexString();
  split.condition = event.params.conditionId.toHexString();
  split.amount = event.params.amount;
  split.save();
}

export function handlePositionsMerge(event: PositionsMerge): void {
  // - don't track merges from the NegRiskExchange
  if (
    [NEG_RISK_EXCHANGE.toHexString()].includes(
      event.params.stakeholder.toHexString(),
    )
  ) {
    return;
  }

  const merge = new Merge(getEventKey(event));
  merge.timestamp = event.block.timestamp;
  merge.stakeholder = event.params.stakeholder.toHexString();
  merge.condition = event.params.conditionId.toHexString();
  merge.amount = event.params.amount;
  merge.save();
}

export function handlePositionsConverted(event: PositionsConverted): void {
  const negRiskEvent = NegRiskEvent.load(event.params.marketId.toHexString());
  if (negRiskEvent == null) {
    return;
  }

  const conversion = new NegRiskConversion(getEventKey(event));
  conversion.timestamp = event.block.timestamp;
  conversion.stakeholder = event.params.stakeholder.toHexString();
  conversion.negRiskMarketId = event.params.marketId.toHexString();
  conversion.amount = event.params.amount;
  conversion.indexSet = event.params.indexSet;
  conversion.questionCount = negRiskEvent.questionCount;
  conversion.save();
}

export function handlePayoutRedemption(event: PayoutRedemption): void {
  const redemption = new Redemption(getEventKey(event));
  redemption.timestamp = event.block.timestamp;
  redemption.redeemer = event.params.redeemer.toHexString();
  redemption.condition = event.params.conditionId.toHexString();
  redemption.indexSets = [BigInt.fromI32(1), BigInt.fromI32(2)];
  redemption.payout = event.params.payout;
  redemption.save();
}

export function handleMarketPrepared(event: MarketPrepared): void {
  const negRiskEvent = new NegRiskEvent(event.params.marketId.toHexString());
  negRiskEvent.questionCount = 0;
  negRiskEvent.save();
}

export function handleQuestionPrepared(event: QuestionPrepared): void {
  let negRiskEvent = NegRiskEvent.load(event.params.marketId.toHexString());
  // if the event is not recognized, return
  if (negRiskEvent == null) {
    return;
  }

  negRiskEvent.questionCount += 1;
  negRiskEvent.save();
}

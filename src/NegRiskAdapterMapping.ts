import { BigInt, Bytes } from '@graphprotocol/graph-ts';

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
import { markAccountAsSeen, requireAccount } from './utils/account-utils';
import { getEventKey } from './utils/getEventKey';
import { NEG_RISK_EXCHANGE, NEG_RISK_OPERATOR, USDC } from './constants';

export function handlePositionSplit(event: PositionSplit): void {
  // - don't track splits from the NegRiskExchange
  if (
    [CONTRACT_ADDRESSES.NegRiskExchange].includes(
      event.params.stakeholder.toHexString(),
    )
  ) {
    return;
  }

  requireAccount(event.params.stakeholder.toHexString(), event.block.timestamp);
  markAccountAsSeen(
    event.params.stakeholder.toHexString(),
    event.block.timestamp,
  );

  const split = new Split(getEventKey(event));

  split.timestamp = event.block.timestamp;
  split.stakeholder = event.params.stakeholder.toHexString();
  split.collateralToken = USDC;
  split.parentCollectionId = Bytes.fromI32(0);
  split.condition = event.params.conditionId.toHexString();
  split.partition = [BigInt.fromI32(1), BigInt.fromI32(2)];
  split.amount = event.params.amount;

  split.save();
}

export function handlePositionsMerge(event: PositionsMerge): void {
  // - don't track merges from the NegRiskExchange
  if ([NEG_RISK_EXCHANGE].includes(event.params.stakeholder.toHexString())) {
    return;
  }

  requireAccount(event.params.stakeholder.toHexString(), event.block.timestamp);
  markAccountAsSeen(
    event.params.stakeholder.toHexString(),
    event.block.timestamp,
  );

  const merge = new Merge(getEventKey(event));

  merge.timestamp = event.block.timestamp;
  merge.stakeholder = event.params.stakeholder.toHexString();
  merge.collateralToken = USDC;
  merge.parentCollectionId = Bytes.fromI32(0);
  merge.condition = event.params.conditionId.toHexString();
  merge.partition = [BigInt.fromI32(1), BigInt.fromI32(2)];
  merge.amount = event.params.amount;

  merge.save();
}

export function handlePositionsConverted(event: PositionsConverted): void {
  requireAccount(event.params.stakeholder.toHexString(), event.block.timestamp);
  markAccountAsSeen(
    event.params.stakeholder.toHexString(),
    event.block.timestamp,
  );

  const negRiskEvent = NegRiskEvent.load(event.params.marketId.toHexString());

  if (negRiskEvent === null) {
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

import { BigInt, Bytes, log } from '@graphprotocol/graph-ts';
import {
  ConditionPreparation,
  PositionSplit,
  PositionsMerge,
  PayoutRedemption,
} from './types/ConditionalTokens/ConditionalTokens';
import {
  Condition,
  Redemption,
  Merge,
  Split,
  Position,
  FixedProductMarketMaker,
} from './types/schema';
import { getEventKey } from '../../common/utils/getEventKey';
import { EXCHANGE, NEG_RISK_ADAPTER } from '../../common/constants';
import { getPositionId } from '../../common/utils/getPositionId';

export function handlePositionSplit(event: PositionSplit): void {
  // - don't track splits within the market makers
  if (
    FixedProductMarketMaker.load(event.params.stakeholder.toHexString()) != null
  ) {
    return;
  }

  // - don't track splits from the NegRiskAdapter
  //   these are handled in the NegRiskAdapterMapping
  // - don't track splits from the CTFExchange
  if (
    [NEG_RISK_ADAPTER.toHexString(), EXCHANGE.toHexString()].includes(
      event.params.stakeholder.toHexString(),
    )
  ) {
    return;
  }

  // skip unrecognized conditions
  const conditionId = event.params.conditionId.toHexString();
  const condition = Condition.load(conditionId);
  if (condition == null) {
    log.error('Failed to update market positions: condition {} not prepared', [
      conditionId,
    ]);
    return;
  }

  const split = new Split(getEventKey(event));
  split.timestamp = event.block.timestamp;
  split.stakeholder = event.params.stakeholder.toHexString();
  split.condition = conditionId;
  split.amount = event.params.amount;
  split.save();
}

export function handlePositionsMerge(event: PositionsMerge): void {
  // - don't track merges within the market makers
  if (
    FixedProductMarketMaker.load(event.params.stakeholder.toHexString()) != null
  ) {
    return;
  }

  // - don't track merges from the NegRiskAdapter
  //   these are handled in the NegRiskAdapterMapping
  // - don't track merges from the CTFExchange
  if (
    [NEG_RISK_ADAPTER.toHexString(), EXCHANGE.toHexString()].includes(
      event.params.stakeholder.toHexString(),
    )
  ) {
    return;
  }

  // skip unrecognized conditions
  const conditionId = event.params.conditionId.toHexString();
  const condition = Condition.load(conditionId);
  if (condition == null) {
    log.error('Failed to update market positions: condition {} not prepared', [
      conditionId,
    ]);
    return;
  }

  const merge = new Merge(getEventKey(event));
  merge.timestamp = event.block.timestamp;
  merge.stakeholder = event.params.stakeholder.toHexString();
  merge.condition = conditionId;
  merge.amount = event.params.amount;
  merge.save();
}

export function handlePayoutRedemption(event: PayoutRedemption): void {
  // - don't track redemptions from the NegRiskAdapter
  //   these are handled in the NegRiskAdapterMapping
  if (
    [NEG_RISK_ADAPTER.toHexString()].includes(
      event.params.redeemer.toHexString(),
    )
  ) {
    return;
  }

  // skip unrecognized conditions
  const conditionId = event.params.conditionId.toHexString();
  const condition = Condition.load(conditionId);
  if (condition == null) {
    log.error('Failed to update market positions: condition {} not prepared', [
      conditionId,
    ]);
    return;
  }

  const redemption = new Redemption(getEventKey(event));
  redemption.timestamp = event.block.timestamp;
  redemption.redeemer = event.params.redeemer.toHexString();
  redemption.condition = conditionId;
  redemption.indexSets = event.params.indexSets;
  redemption.payout = event.params.payout;
  redemption.save();
}

export function handleConditionPreparation(event: ConditionPreparation): void {
  // we don't handle conditions with more than 2 outcomes
  if (event.params.outcomeSlotCount.toI32() != 2) {
    return;
  }

  // new condition
  const conditionId = event.params.conditionId.toHexString();
  const condition = new Condition(conditionId);
  condition.save();

  const negRisk =
    event.params.oracle.toHexString() == NEG_RISK_ADAPTER.toHexString();

  // @ts-expect-error Cannot find name 'u8'.
  for (let outcomeIndex: u8 = 0; outcomeIndex < 2; outcomeIndex++) {
    // compute the position id
    const positionId = getPositionId(
      Bytes.fromHexString(conditionId),
      outcomeIndex,
      negRisk,
    ).toString();

    if (!Position.load(positionId)) {
      const position = new Position(positionId);
      position.condition = event.params.conditionId.toHexString();
      position.outcomeIndex = BigInt.fromI32(outcomeIndex);
      position.save();
    }
  }
}

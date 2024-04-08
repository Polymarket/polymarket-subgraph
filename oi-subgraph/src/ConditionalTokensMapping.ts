import { BigInt, Bytes, log } from '@graphprotocol/graph-ts';
import {
  ConditionPreparation,
  PositionSplit,
  PositionsMerge,
  PayoutRedemption,
} from './types/ConditionalTokens/ConditionalTokens';
import { Condition, Position } from './types/schema';
import { NEG_RISK_ADAPTER } from '../../common/constants';
import { getPositionId } from '../../common/utils/getPositionId';
import { updateOpenInterest } from './oi-utils';

export function handlePositionSplit(event: PositionSplit): void {
  // skip unrecognized conditions
  const conditionId = event.params.conditionId.toHexString();
  const condition = Condition.load(conditionId);

  // Split increases OI
  const amount = event.params.amount;
  if (condition == null) {
    log.error('Failed to update OI: condition {} not prepared', [conditionId]);
    return;
  }
  updateOpenInterest(conditionId, amount);
}

export function handlePositionsMerge(event: PositionsMerge): void {
  // skip unrecognized conditions
  const conditionId = event.params.conditionId.toHexString();
  const condition = Condition.load(conditionId);

  // Merge reduces OI
  const amount = event.params.amount.neg();
  if (condition == null) {
    log.error('Failed to update OI: condition {} not prepared', [conditionId]);
    return;
  }

  updateOpenInterest(conditionId, amount);
}

export function handlePayoutRedemption(event: PayoutRedemption): void {
  // skip unrecognized conditions
  const conditionId = event.params.conditionId.toHexString();
  const condition = Condition.load(conditionId);
  // Redeem reduces OI
  const amount = event.params.payout.neg();
  if (condition == null) {
    log.error('Failed to update OI: condition {} not prepared', [conditionId]);
    return;
  }

  updateOpenInterest(conditionId, amount);
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
}

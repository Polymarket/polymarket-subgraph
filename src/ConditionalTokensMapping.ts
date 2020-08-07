import { BigInt, BigDecimal, log } from '@graphprotocol/graph-ts'

import { ConditionPreparation, ConditionResolution, PositionSplit, PositionsMerge, PayoutRedemption } from '../generated/ConditionalTokens/ConditionalTokens'
import { Condition, Redemption, Merge, Split } from '../generated/schema'
import { requireGlobal } from './utils/global-utils';

export function handlePositionSplit(event: PositionSplit): void {
  let split = new Split(event.transaction.hash.toHexString());
  split.stakeholder = event.params.stakeholder.toHexString();
  split.collateralToken = event.params.collateralToken;
  split.parentCollectionId = event.params.parentCollectionId;
  split.condition = event.params.conditionId.toHexString();
  split.partition = event.params.partition;
  split.amount = event.params.amount;
  split.save();
}

export function handlePositionsMerge(event: PositionsMerge): void {
  let merge = new Merge(event.transaction.hash.toHexString());
  merge.stakeholder = event.params.stakeholder.toHexString();
  merge.collateralToken = event.params.collateralToken;
  merge.parentCollectionId = event.params.parentCollectionId;
  merge.condition = event.params.conditionId.toHexString();
  merge.partition = event.params.partition;
  merge.amount = event.params.amount;
  merge.save();
}

export function handlePayoutRedemption(event: PayoutRedemption): void {
  let redemption = new Redemption(event.transaction.hash.toHexString());
  redemption.redeemer = event.params.redeemer.toHexString();
  redemption.collateralToken = event.params.collateralToken;
  redemption.parentCollectionId = event.params.parentCollectionId;
  redemption.condition = event.params.conditionId.toHexString();
  redemption.indexSets = event.params.indexSets;
  redemption.payout = event.params.payout;
  redemption.save();
}

export function handleConditionPreparation(event: ConditionPreparation): void {
  let condition = new Condition(event.params.conditionId.toHexString());
  condition.oracle = event.params.oracle;
  condition.questionId = event.params.questionId;

  let global = requireGlobal();
  global.numConditions++;
  global.numOpenConditions++;
  global.save();

  condition.outcomeSlotCount = event.params.outcomeSlotCount.toI32();
  condition.save();
}

export function handleConditionResolution(event: ConditionResolution): void {
  let conditionId = event.params.conditionId.toHexString()
  let condition = Condition.load(conditionId);
  if (condition == null) {
    log.error('could not find condition {} to resolve', [conditionId]);
    return;
  }

  let global = requireGlobal();
  global.numOpenConditions--;
  global.numClosedConditions++;
  global.save();

  if (condition.resolutionTimestamp != null || condition.payouts != null) {
    log.error('should not be able to resolve condition {} more than once', [conditionId]);
    return;
  }

  condition.resolutionTimestamp = event.block.timestamp;

  let payoutNumerators = event.params.payoutNumerators;
  let payoutDenominator = BigInt.fromI32(0);
  for (let i = 0; i < payoutNumerators.length; i++) {
    payoutDenominator = payoutDenominator.plus(payoutNumerators[i]);
  }
  let payoutDenominatorDec = payoutDenominator.toBigDecimal();
  let payouts = new Array<BigDecimal>(payoutNumerators.length);
  for (let i = 0; i < payouts.length; i++) {
    payouts[i] = payoutNumerators[i].divDecimal(payoutDenominatorDec);
  }
  condition.payouts = payouts;

  condition.save();
}
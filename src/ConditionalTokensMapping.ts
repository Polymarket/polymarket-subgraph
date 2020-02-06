import { BigInt, log, BigDecimal } from '@graphprotocol/graph-ts'

import { ConditionPreparation, ConditionResolution } from '../generated/ConditionalTokens/ConditionalTokens'
import { Condition } from '../generated/schema'

export function handleConditionPreparation(event: ConditionPreparation): void {
  let condition = new Condition(event.params.conditionId.toHexString());
  condition.outcomeSlotCount = event.params.outcomeSlotCount;
  condition.save();
}

export function handleConditionResolution(event: ConditionResolution): void {
  let conditionId = event.params.conditionId.toHexString()
  let condition = Condition.load(conditionId);
  if (condition == null) {
    log.error('could not find condition {} to resolve', [conditionId]);
    return;
  }

  if (condition.payouts != null) {
    log.error('should not be able to resolve condition {} more than once', [conditionId]);
    return;
  }

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
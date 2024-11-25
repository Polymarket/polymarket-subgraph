import {
    ConditionPreparation,
  } from './types/ConditionalTokens/ConditionalTokens';
import { Condition } from './types/schema';

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
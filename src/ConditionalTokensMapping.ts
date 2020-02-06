import { ConditionPreparation } from '../generated/ConditionalTokens/ConditionalTokens'
import { Condition } from '../generated/schema'

export function handleConditionPreparation(event: ConditionPreparation): void {
  let condition = new Condition(event.params.conditionId.toHexString());
  condition.outcomeSlotCount = event.params.outcomeSlotCount;
  condition.save();
}

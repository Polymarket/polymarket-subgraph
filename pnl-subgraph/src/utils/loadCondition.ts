import { Bytes } from '@graphprotocol/graph-ts';

import { Condition } from '../types/schema';

const loadCondition = (conditionId: Bytes): Condition | null => {
  let condition = Condition.load(conditionId.toHexString());

  if (condition == null) {
    return null;
  }

  return condition;
};

export { loadCondition };

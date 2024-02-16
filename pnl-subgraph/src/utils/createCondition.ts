import { log, BigInt, Bytes } from '@graphprotocol/graph-ts';

import { Condition } from '../types/schema';
import { getPositionId } from '../../../common';

// does not save the condition
const createCondition = (conditionId: Bytes, negRisk: boolean): Condition => {
  let condition = Condition.load(conditionId.toHexString());
  if (condition != null) {
    log.error('Condition already exists: {}', [conditionId.toHexString()]);
    throw new Error('Condition already exists');
  }

  condition = new Condition(conditionId.toHexString());
  condition.payoutDenominator = BigInt.zero();
  condition.payoutNumerators = [];
  condition.positionIds = [
    getPositionId(conditionId, 0, negRisk),
    getPositionId(conditionId, 1, negRisk),
  ];

  return condition;
};

export { createCondition };

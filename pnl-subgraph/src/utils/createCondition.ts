import { log, BigInt, Bytes } from '@graphprotocol/graph-ts';

import { Condition } from '../types/schema';

const createCondition = (conditionId: Bytes): Condition => {
  let condition = Condition.load(conditionId.toHexString());

  if (condition != null) {
    log.error('Condition already exists: {}', [conditionId.toHexString()]);
    throw new Error('Condition already exists');
  }

  condition = new Condition(conditionId.toHexString());
  condition.payoutDenominator = BigInt.zero();
  condition.payoutNumerators = [];

  return condition;
};

export { createCondition };

/* eslint-disable @typescript-eslint/ban-types */

import { Bytes } from '@graphprotocol/graph-ts';
import { NEG_RISK_ADAPTER } from '../constants';
import { getNegRiskQuestionId } from './getNegRiskQuestionId';
import { getConditionId } from './getConditionId';

const getNegRiskConditionId = (
  negRiskMarketId: Bytes,
  // @ts-expect-error Cannot find name 'u8'.
  questionIndex: u8,
): Bytes => {
  const questionId = getNegRiskQuestionId(negRiskMarketId, questionIndex);
  const conditionId = getConditionId(NEG_RISK_ADAPTER, questionId);

  return conditionId;
};

export { getNegRiskConditionId };

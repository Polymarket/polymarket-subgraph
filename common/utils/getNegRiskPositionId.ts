/* eslint-disable @typescript-eslint/ban-types */

import { BigInt, Bytes } from '@graphprotocol/graph-ts';
import { NEG_RISK_ADAPTER, NEG_RISK_WRAPPED_COLLATERAL } from '../constants';
import { getNegRiskQuestionId } from './getNegRiskQuestionId';
import { getConditionId } from './getConditionId';
import { computePositionId } from './ctf-utils';

const getNegRiskPositionId = (
  negRiskMarketId: Bytes,
  // @ts-expect-error Cannot find name 'u8'.
  questionIndex: u8,
  // @ts-expect-error Cannot find name 'u8'.
  outcomeIndex: u8, // 0 is YES, 1 is NO
): BigInt => {
  const questionId = getNegRiskQuestionId(negRiskMarketId, questionIndex);
  const conditionId = getConditionId(NEG_RISK_ADAPTER, questionId);

  const positionId = computePositionId(
    NEG_RISK_WRAPPED_COLLATERAL,
    conditionId,
    outcomeIndex,
  );

  return positionId;
};

export { getNegRiskPositionId };

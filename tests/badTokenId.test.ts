import { assert, describe, test } from 'matchstick-as/assembly/index';
import { Bytes } from '@graphprotocol/graph-ts';

import {
  computePositionId,
  getConditionId,
  getNegRiskQuestionId,
} from '../common';
import {
  NEG_RISK_ADAPTER,
  NEG_RISK_WRAPPED_COLLATERAL,
} from '../common/constants';

describe('getBadTokenId', () => {
  test('It should get the good token id', () => {
    // this works !
    const negRiskMarketId =
      '0x904aa321a48f737e2223e7b3007bf51d68b6a0d66bdda0c1e4bc581f55d62800';
    // @ts-expect-error Cannot find name 'u8'.
    const questionIndex: u8 = 4;
    const expectedPositionId0 =
      '11031149734538275426690039809123992018327740438980973428241361937177748285493';

    const positionId = computePositionId(
      NEG_RISK_WRAPPED_COLLATERAL,
      getConditionId(
        NEG_RISK_ADAPTER,
        getNegRiskQuestionId(
          Bytes.fromHexString(negRiskMarketId),
          questionIndex,
        ),
      ),
      0,
    );

    assert.stringEquals(positionId.toString(), expectedPositionId0.toString());
  });

  test('It should get the bad token id', () => {
    // this does not work
    const negRiskMarketId =
      '0x904aa321a48f737e2223e7b3007bf51d68b6a0d66bdda0c1e4bc581f55d62800';
    // @ts-expect-error Cannot find name 'u8'.
    const questionIndex: u8 = 4;

    const expectedPositionId1 =
      '92849115097658926029726616555072992123532598747617388960074918380114146610948';

    const positionId = computePositionId(
      NEG_RISK_WRAPPED_COLLATERAL,
      getConditionId(
        NEG_RISK_ADAPTER,
        getNegRiskQuestionId(
          Bytes.fromHexString(negRiskMarketId),
          questionIndex,
        ),
      ),
      1,
    );

    // we are not computing the second token id correctly
    // instead, we get 89680352973735649162001103326678115456771146419311067814271616617446987339910
    // I believe this is the source of our issues
    assert.stringEquals(positionId.toString(), expectedPositionId1.toString());
  });
});

import { assert, describe, test } from 'matchstick-as/assembly/index';
import { Address, Bytes } from '@graphprotocol/graph-ts';
import { computePositionId } from '../common/utils/ctf-utils';

describe('getPositionId', () => {
  test('It should compute the positionId', () => {
    const conditionId =
      '0xda558eddf6eb57760bd5371fb313167f871d823a16e9d66fccb292baf2a117c0';
    const collateralAddress = '0x7D1DC38E60930664F8cBF495dA6556ca091d2F92';
    const expectedPositionId0 =
      '108051088633899060239124498527429950692254744883563327407154880807410490438693';
    const expectedPositionId1 =
      '45163082656174410071592939534766820181648934703824597457997612898109272294349';

    const computedPositionId0 = computePositionId(
      Address.fromString(collateralAddress),
      Bytes.fromHexString(conditionId),
      0,
    );
    const computedPositionId1 = computePositionId(
      Address.fromString(collateralAddress),
      Bytes.fromHexString(conditionId),
      1,
    );

    assert.stringEquals(expectedPositionId0, computedPositionId0.toString());
    assert.stringEquals(expectedPositionId1, computedPositionId1.toString());
  });
});

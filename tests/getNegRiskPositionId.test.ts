import { assert, describe, test } from 'matchstick-as/assembly/index';
import { Bytes } from '@graphprotocol/graph-ts';
import { getNegRiskPositionId } from '../common/utils/getNegRiskPositionId';

describe('getNegRiskPositionId', () => {
  test('It should get the negRisk positionId', () => {
    const negRiskMarketId =
      '0xcc4727a6394620b9c8ae82db3db50a34d5ca9828675547bcc4cddf5e86b63000';
    // @ts-expect-error Cannot find name 'u8'.
    const questionIndex: u8 = 7;
    const expectedPositionId0 =
      '96833685517457790753237027711749956491556223430098771101130535462280443103710';
    const expectedPositionId1 =
      '112683192116716745370273337699109698649408967993699289993927321945615517688893';

    const computedPositionId0 = getNegRiskPositionId(
      Bytes.fromHexString(negRiskMarketId),
      questionIndex,
      0,
    );
    const computedPositionId1 = getNegRiskPositionId(
      Bytes.fromHexString(negRiskMarketId),
      questionIndex,
      1,
    );

    assert.stringEquals(expectedPositionId0, computedPositionId0.toString());
    assert.stringEquals(expectedPositionId1, computedPositionId1.toString());
  });
});

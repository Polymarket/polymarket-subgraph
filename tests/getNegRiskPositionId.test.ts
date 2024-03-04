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

  test('It should get the negRisk positionId 2', () => {
    const negRiskMarketId =
      '0x904aa321a48f737e2223e7b3007bf51d68b6a0d66bdda0c1e4bc581f55d62800';
    // @ts-expect-error Cannot find name 'u8'.
    const questionIndex: u8 = 4;
    const expectedPositionId0 =
      '11031149734538275426690039809123992018327740438980973428241361937177748285493';
    const expectedPositionId1 =
      '92849115097658926029726616555072992123532598747617388960074918380114146610948';

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

  test('It should get the negRisk positionId 3', () => {
    const negRiskMarketId =
      '0x904aa321a48f737e2223e7b3007bf51d68b6a0d66bdda0c1e4bc581f55d62800';
    // @ts-expect-error Cannot find name 'u8'.
    const questionIndex: u8 = 3;
    const expectedPositionId0 =
      '92934986068759649975171712359405804888500621431140776758674716227798619042594';
    const expectedPositionId1 =
      '83272680118121060051327450493118657102857345150945269348505485036103238138715';

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

  test('It should get the negRisk positionId 4', () => {
    const negRiskMarketId =
      '0x5e596465dca57c10c8b175f901974e2de2877498410b0210d0a21b57e14da000';
    // @ts-expect-error Cannot find name 'u8'.
    const questionIndex: u8 = 4;
    const expectedPositionId0 =
      '30637845681714148498359907433169105263223689440526909041094893305583115580796';
    const expectedPositionId1 =
      '111796127100720291855951404495290728144208289103084969375425640210971192620108';

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

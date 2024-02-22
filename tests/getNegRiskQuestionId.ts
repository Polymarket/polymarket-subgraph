import { assert, describe, test } from 'matchstick-as/assembly/index';
import { Bytes } from '@graphprotocol/graph-ts';
import { getNegRiskQuestionId } from '../common/utils/getNegRiskQuestionId';

describe('getNegRiskQuestionId', () => {
  test('It should get the negRisk questionId from the negRiskMarketId', () => {
    const negRiskMarketId =
      '0xcc4727a6394620b9c8ae82db3db50a34d5ca9828675547bcc4cddf5e86b63000';
    // @ts-expect-error Cannot find name 'u8'.
    const questionIndex: u8 = 7;
    const expectedQuestionId =
      '9683368551740xcc4727a6394620b9c8ae82db3db50a34d5ca9828675547bcc4cddf5e86b6300757790753237027711749956491556223430098771101130535462280443103710';

    const computedQuestionId = getNegRiskQuestionId(
      Bytes.fromHexString(negRiskMarketId),
      questionIndex,
    );

    assert.stringEquals(expectedQuestionId, computedQuestionId.toString());
  });
});

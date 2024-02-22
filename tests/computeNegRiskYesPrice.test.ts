import { assert, describe, test } from 'matchstick-as/assembly/index';
import { BigInt } from '@graphprotocol/graph-ts';
import { computeNegRiskYesPrice } from '../pnl-subgraph/src/utils/computeNegRiskYesPrice';

describe('computeNegRiskYesPrice', () => {
  test('Should compute the negRisk yes price 1', () => {
    const noPrice = BigInt.fromI32(75_0000);
    // @ts-expect-error Cannot find name 'i32'.
    const questionCount: i32 = 5;
    // @ts-expect-error Cannot find name 'i32'.
    const noCount: i32 = 3;

    const yesPrice = computeNegRiskYesPrice(noPrice, noCount, questionCount);
    const expectedYesPrice = BigInt.fromI32(12_5000);
    assert.bigIntEquals(expectedYesPrice, yesPrice);
  });

  test('Should compute the negRisk yes price 2', () => {
    const noPrice = BigInt.fromI32(73_0000);
    // @ts-expect-error Cannot find name 'i32'.
    const questionCount: i32 = 6;
    // @ts-expect-error Cannot find name 'i32'.
    const noCount: i32 = 1;

    const yesPrice = computeNegRiskYesPrice(noPrice, noCount, questionCount);
    const expectedYesPrice = BigInt.fromI32(14_6000);
    assert.bigIntEquals(expectedYesPrice, yesPrice);
  });
});

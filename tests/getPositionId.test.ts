import { assert, describe, test } from 'matchstick-as/assembly/index';
import { Bytes } from '@graphprotocol/graph-ts';
import { getPositionId } from '../common/utils/getPositionId';

describe('getPositionId', () => {
  test('It should compute the positionId for standard markets', () => {
    const conditionId =
      '0xfc690d5069b296bb9278af0cba42c02666e0999e4a4009ed97ea4a885f045457';
    const expectedPositionId0 =
      '73716170047628147940237270507900673332129573201293655532643868111690843426372';
    const expectedPositionId1 =
      '2890213445014127424511466931609154310536269586265875141655148162320150952197';

    const computedPositionId0 = getPositionId(
      Bytes.fromHexString(conditionId),
      0,
      false,
    );
    const computedPositionId1 = getPositionId(
      Bytes.fromHexString(conditionId),
      1,
      false,
    );

    assert.stringEquals(expectedPositionId0, computedPositionId0.toString());
    assert.stringEquals(expectedPositionId1, computedPositionId1.toString());
  });

  test('It should compute the positionId for negRisk Markets', () => {
    const conditionId =
      '0xbf5ba08b3a0c4dd741f00759282e38e9bfa9ad59aa623ed13d26a8786c1e5afc';
    const expectedPositionId0 =
      '84121562275746951169805992721206824933074826856805500029198362509460400440947';
    const expectedPositionId1 =
      '6492254133524731704185750998715576231739345323060925006131340263114065023619';

    const computedPositionId0 = getPositionId(
      Bytes.fromHexString(conditionId),
      0,
      true,
    );
    const computedPositionId1 = getPositionId(
      Bytes.fromHexString(conditionId),
      1,
      true,
    );

    assert.stringEquals(expectedPositionId0, computedPositionId0.toString());
    assert.stringEquals(expectedPositionId1, computedPositionId1.toString());
  });
});

import { assert, describe, test } from 'matchstick-as/assembly/index';
import { Bytes } from '@graphprotocol/graph-ts';
import { computeCollectionId } from '../common/utils/ctf-utils';

describe('getCollectionId', () => {
  test('It should compute the collectionId', () => {
    const conditionId =
      '0xdb4ab1dbbedd6aeec17aa6e3f66262cff0e3b04742dd3acdf99652575e5422f8';
    const expectedCollectionId0 =
      '0x12adf3dfeaddeef8f31fa86654bf367c5c7b1e854dff407d7c87ff76af4ad16d';
    const expectedCollectionId1 =
      '0x2f5ebcc5972889a57d587b7088d543bbf464fbdd2b2c4cb7c276ca3d4d70415b';

    const computedCollectionId0 = computeCollectionId(
      Bytes.fromHexString(conditionId),
      0,
    );
    const computedCollectionId1 = computeCollectionId(
      Bytes.fromHexString(conditionId),
      1,
    );

    assert.bytesEquals(
      Bytes.fromHexString(expectedCollectionId0),
      computedCollectionId0,
    );
    assert.bytesEquals(
      Bytes.fromHexString(expectedCollectionId1),
      computedCollectionId1,
    );
  });

  test('It should compute the collectionId (odd)', () => {
    const conditionId =
      '0xda558eddf6eb57760bd5371fb313167f871d823a16e9d66fccb292baf2a117c0';
    const expectedCollectionId0 =
      '0x45ca66c3edbdbf0fbd03366cf395d3663ee3b34c4db07964bb60e3c7ca7e20e2';
    const expectedCollectionId1 =
      '0x416929e8901456139abeec231eba635f911a240961f78919665280c69288ee0d';

    const computedCollectionId0 = computeCollectionId(
      Bytes.fromHexString(conditionId),
      0,
    );
    const computedCollectionId1 = computeCollectionId(
      Bytes.fromHexString(conditionId),
      1,
    );

    assert.bytesEquals(
      Bytes.fromHexString(expectedCollectionId0),
      computedCollectionId0,
    );
    assert.bytesEquals(
      Bytes.fromHexString(expectedCollectionId1),
      computedCollectionId1,
    );
  });
});

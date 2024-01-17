import { assert, describe, test } from 'matchstick-as/assembly/index';
import { log } from 'matchstick-as/assembly/log';
import { Bytes } from '@graphprotocol/graph-ts';
import { getCollectionId3 } from '../src/utils/ctf-utils';

// describe('getCollectionId()', () => {
//   test('Should fail', () => {
//     assert.assertTrue(true);
//   });
// });

const conditionId =
  '0xdb4ab1dbbedd6aeec17aa6e3f66262cff0e3b04742dd3acdf99652575e5422f8';
const expectedCollectionId =
  '0x12adf3dfeaddeef8f31fa86654bf367c5c7b1e854dff407d7c87ff76af4ad16d';

test('Should match the on-chain version', () => {
  const computedCollectionId = getCollectionId3(
    Bytes.fromHexString(conditionId),
    0,
  );

  assert.bytesEquals(
    Bytes.fromHexString(expectedCollectionId),
    computedCollectionId,
  );
});

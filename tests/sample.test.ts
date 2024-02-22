import { assert, describe, test } from 'matchstick-as/assembly/index';

describe('sampleTest()', () => {
  test('Should pass', () => {
    assert.assertTrue(true);
    assert.assertNotNull(1);
  });
});

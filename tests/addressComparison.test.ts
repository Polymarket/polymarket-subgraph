import { Address } from '@graphprotocol/graph-ts';
import { assert, describe, test } from 'matchstick-as/assembly/index';

describe('addressComparison()', () => {
  test('Should compare address.toHexString to address string', () => {
    const addressLowercaseString = '0x84834141f76bdb7ee72a9e67ca7bd1e849288c3a';
    const address = Address.fromString(addressLowercaseString);
    assert.stringEquals(address.toHexString(), addressLowercaseString);
  });
});

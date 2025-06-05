import { Address, Bytes, crypto } from '@graphprotocol/graph-ts';
import { test, assert, describe } from 'matchstick-as/assembly/index';
import { computeCreate2Address } from '../common/utils/computeCreate2Address';

describe('computeCreate2Address()', () => {
  test('computeCreate2Address returns correct value', () => {
    const deployer = Address.fromString(
      '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
    );
    const salt = Bytes.fromHexString(
      '0x7c5ea36004851c764c44143b1dcb59679b11c9a68e5f41497f6cf3d480715331',
    );
    const initCode = Bytes.fromHexString(
      '0x6394198df16000526103ff60206004601c335afa6040516060f3',
    );
    const initCodeHash = Bytes.fromUint8Array(crypto.keccak256(initCode));

    const expected = Address.fromString(
      '0x533ae9d683B10C02EbDb05471642F85230071FC3',
    );
    const result = computeCreate2Address(deployer, salt, initCodeHash);

    assert.addressEquals(result, expected);
  });
});

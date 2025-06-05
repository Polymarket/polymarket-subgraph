import { Address } from '@graphprotocol/graph-ts';
import { test, assert, describe } from 'matchstick-as/assembly/index';

import {
  computeProxyWalletAddress,
  generateProxyWalletBytecode,
} from '../common/utils/computeProxyWalletAddress';

describe('computeProxyWalletAddress()', () => {
  test('Should generate correct proxyWalletBytecode', () => {
    const factoryAddress = Address.fromString(
      '0x2279b7a0a67db372996a5fab50d91eaa73d2ebe6',
    );
    const implementationAddress = Address.fromString(
      '0xdb49cad7f11f8b7ff228044befa0ef3f3b5b4225',
    );

    const expectedBytecodeHex =
      '0x3d3d606380380380913d393d732279b7a0a67db372996a5fab50d91eaa73d2ebe65af4602a57600080fd5b602d8060366000396000f3363d3d373d3d3d363d73db49cad7f11f8b7ff228044befa0ef3f3b5b42255af43d82803e903d91602b57fd5bf352e831dd00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000';
    const bytecodeHex = generateProxyWalletBytecode(
      factoryAddress,
      implementationAddress,
    ).toHexString();

    assert.stringEquals(bytecodeHex, expectedBytecodeHex);
  });

  test('computeProxyWalletAddress returns correct value', () => {
    const signer = Address.fromString(
      '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    );
    const factory = Address.fromString(
      '0xEcA1c266193F03d28517a500007738adfb7754d8',
    );
    const implementation = Address.fromString(
      '0x7d5330Fe12E75B5B775036cC1ba39EE546bD3850',
    );

    const expected = Address.fromString(
      '0x03CaCD9b90eDf7E440227faeA044e566247a8635',
    );
    const result = computeProxyWalletAddress(signer, factory, implementation);

    assert.addressEquals(result, expected);
  });
});

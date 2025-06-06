import { Address, Bytes, crypto } from '@graphprotocol/graph-ts';

import { computeCreate2Address } from './computeCreate2Address';

export function generateProxyWalletBytecode(
  factory: Address,
  implementation: Address,
): Bytes {
  let bytecodeHex =
    '3d3d606380380380913d393d73' +
    factory.toHexString().slice(2).toLowerCase() +
    '5af4602a57600080fd5b602d8060366000396000f3363d3d373d3d3d363d73' +
    implementation.toHexString().slice(2).toLowerCase() +
    '5af43d82803e903d91602b57fd5bf352e831dd' +
    '0000000000000000000000000000000000000000000000000000000000000020' +
    '0000000000000000000000000000000000000000000000000000000000000000';

  return Bytes.fromHexString('0x' + bytecodeHex) as Bytes;
}

export function computeProxyWalletAddress(
  signer: Address,
  factory: Address,
  implementation: Address,
): Address {
  const signerPacked = Bytes.fromUint8Array(signer);
  const salt = Bytes.fromUint8Array(crypto.keccak256(signerPacked));

  const initCode = generateProxyWalletBytecode(factory, implementation);
  const initCodeHash = Bytes.fromUint8Array(crypto.keccak256(initCode));

  return computeCreate2Address(factory, salt, initCodeHash);
}

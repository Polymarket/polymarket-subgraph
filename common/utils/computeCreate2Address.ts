import { Address, Bytes, crypto } from '@graphprotocol/graph-ts';

export function computeCreate2Address(
  deployer: Address,
  salt: Bytes,
  initCodeHash: Bytes,
): Address {
  const prefix = Bytes.fromHexString('0xff') as Bytes;
  const data = prefix.concat(deployer).concat(salt).concat(initCodeHash);

  const fullHash = crypto.keccak256(data);
  const addrBytes = fullHash.subarray(12, 32);

  return Address.fromBytes(Bytes.fromUint8Array(addrBytes));
}

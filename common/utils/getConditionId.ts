import { Address, crypto, Bytes } from '@graphprotocol/graph-ts';

// getConditionId with outcomeSlotCount = 2
const getConditionId = (oracle: Address, questionId: Bytes): Bytes => {
  // 20 + 32 + 32
  let hashPayload = new Uint8Array(84);
  hashPayload.fill(0);

  // 20 bytes for the token address
  for (let i = 0; i < 20; i++) {
    hashPayload[i] = oracle[i];
  }

  // 32 bytes for the collectionId
  for (let i = 0; i < 32; i++) {
    hashPayload[i + 20] = questionId[i];
  }

  hashPayload[83] = 0x02;

  return Bytes.fromByteArray(
    crypto.keccak256(Bytes.fromUint8Array(hashPayload)),
  );
};

export { getConditionId };

/* eslint-disable @typescript-eslint/ban-types */
import { Address, log, crypto, BigInt, Bytes } from '@graphprotocol/graph-ts';
import { ConditionalTokens } from '../types/ConditionalTokens/ConditionalTokens';

const computePositionId = (collateral: string, collectionId: Bytes): Bytes => {
  let collateralToken = Address.fromHexString(collateral);
  let hashPayload = new Uint8Array(52);
  hashPayload.fill(0);
  // 20 bytes for the token address
  for (let i = 0; i < collateralToken.length && i < 20; i++) {
    hashPayload[i] = collateralToken[i];
  }
  // 32 bytes for the collectionId
  for (let i = 0; i < collectionId.length && i < 32; i++) {
    hashPayload[i + 20] = collectionId[i];
  }
  return Bytes.fromByteArray(
    crypto.keccak256(Bytes.fromUint8Array(hashPayload)),
  );
};

// const buildHashPayloadForInitHash = (
//   conditionId: string,
//   indexSet: number,
// ): Bytes => {
//   let hashPayload = new Uint8Array(64);
//   hashPayload.fill(0);
//   let conditionIdBytes = Bytes.fromHexString(conditionId);
//   let indexSetBytes = Bytes.fromBigInt(BigInt.fromString(`${indexSet}`));
//   for (let i = 0; i < conditionIdBytes.length && i < 32; i++) {
//     hashPayload[i] = conditionIdBytes[i];
//   }

//   for (let i = 0; i < indexSetBytes.length && i < 32; i++) {
//     hashPayload[i + 32] = indexSetBytes[i];
//   }
//   return hashPayload as Bytes;
// };

const calculateCollectionIds = (
  conditionalTokenAddress: string,
  conditionId: string,
  outcomeSlotCount: number,
): Bytes[] => {
  const conditionalToken = ConditionalTokens.bind(
    Address.fromString(conditionalTokenAddress),
  );
  const conditionIdBytes = Bytes.fromHexString(conditionId);
  const collectionIds: Bytes[] = [];
  const hashZero = new Uint8Array(32);
  hashZero.fill(0);
  const hashZeroBytes = Bytes.fromUint8Array(hashZero);

  for (let i = 1; i <= outcomeSlotCount; i += 1) {
    const collectionId = conditionalToken.getCollectionId(
      hashZeroBytes,
      conditionIdBytes,
      BigInt.fromI32(i),
    );

    log.info('LOG: CTFUtils Found collectionId: {}!', [
      collectionId.toHexString(),
    ]);

    collectionIds.push(collectionId);
  }
  return collectionIds;
};

/**
 * Calculates ERC1155 token Ids
 * @param conditionId
 * @param collateral
 * @param outcomeSlotCount
 * @returns
 */
export const calculatePositionIds = (
  conditionalTokenAddress: string,
  conditionId: string,
  collateral: string,
  outcomeSlotCount: number,
): string[] => {
  log.info(
    'LOG: CTFUtils: Calculating position ids for conditionId: {}, collateral: {}, outcomeSlotCount: {}',
    [conditionId, collateral, outcomeSlotCount.toString()],
  );

  const collectionIds: Bytes[] = calculateCollectionIds(
    conditionalTokenAddress,
    conditionId,
    outcomeSlotCount,
  );

  const positionIds: string[] = [];
  for (let i = 0; i < collectionIds.length; i++) {
    const collectionId = collectionIds[i];
    const positionIdBytes = computePositionId(collateral, collectionId);
    const positionIdHex = positionIdBytes.toHexString();
    log.info('LOG: CTFUtils Generated PositionId Hex: {}', [positionIdHex]);

    log.info('LOG: CTFUtils Generated PositionId str: {}', [
      parseInt(positionIdHex, 16).toString(10),
    ]);

    positionIds.push(parseInt(positionIdHex, 16).toString());
  }

  log.info('LOG: CTFUtils PositionIds: {}!', [positionIds.toString()]);
  return positionIds;
};

/* eslint-disable @typescript-eslint/ban-types */
import {
  Address,
  crypto,
  BigInt,
  Bytes,
  ByteArray,
} from '@graphprotocol/graph-ts';
import { ConditionalTokens } from '../types/ConditionalTokens/ConditionalTokens';

const computePositionId = (
  collateral: string,
  collectionId: Bytes,
): ByteArray => {
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
  return crypto.keccak256(Bytes.fromUint8Array(hashPayload));
};

/**
 * Assemblyscript compatible hex to decimal string implementation
 * Used due to bug in BigInt.toString
 * @param hex
 * @returns string
 */
const hexToDecimalString = (hex: string): string => {
  function add(x: string, y: string): string {
    let c = 0;
    let r = [];
    let zero = 0;
    let one = 1;
    let ten = 10;

    let xArr = x.split('');
    let yArr = y.split('');
    let xNumArr: number[] = [];
    let yNumArr: number[] = [];
    for (let i = 0; i < xArr.length; i++) {
      xNumArr.push(parseInt(xArr[i], 10));
    }

    for (let i = 0; i < yArr.length; i++) {
      yNumArr.push(parseInt(yArr[i], 10));
    }

    while (xNumArr.length || yNumArr.length) {
      const xVal: number = xNumArr.length > 0 ? xNumArr.pop() : zero;
      const yVal: number = yNumArr.length > 0 ? yNumArr.pop() : zero;
      let s = xVal + yVal + c;
      let shift: u32 = <u32>(s < ten ? s : s - ten);
      if (r.length == 0) {
        r.push(shift);
      } else {
        r.unshift(shift);
      }
      c = s < ten ? zero : one;
    }
    if (c) r.unshift(c);
    return r.join('');
  }

  let dec = '0';
  let one = '1';
  let maskArr: number[] = [8, 4, 2, 1];
  const arr = hex.split('').slice(2); // rm 0x
  for (let i = 0; i < arr.length; i++) {
    let n = parseInt(arr[i], 16) as i32;
    for (let j = 0; j < maskArr.length; j++) {
      dec = add(dec, dec);
      let mask = maskArr[j] as i32;
      if (n & mask) dec = add(dec, one);
    }
  }
  return dec;
};

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
  const collectionIds: Bytes[] = calculateCollectionIds(
    conditionalTokenAddress,
    conditionId,
    outcomeSlotCount,
  );

  const positionIds: string[] = [];
  for (let i = 0; i < collectionIds.length; i++) {
    const collectionId = collectionIds[i];
    const positionIdByteArray = computePositionId(collateral, collectionId);
    const positionIdHex = positionIdByteArray.toHexString();
    const positionIdStr = hexToDecimalString(positionIdHex);
    positionIds.push(positionIdStr);
  }
  return positionIds;
};

/**
 * Gets the CTF ERC1155 tokenId
 * @param conditionalTokenAddress
 * @param conditionId
 * @param collateral
 * @param outcomeSlotCount
 * @param outcomeIndex
 */
export const getMarket = (
  conditionalTokenAddress: string,
  conditionId: string,
  collateral: string,
  outcomeSlotCount: number,
  outcomeIndex: number,
): string => {
  const positionIds: string[] = calculatePositionIds(
    conditionalTokenAddress,
    conditionId,
    collateral,
    outcomeSlotCount,
  );
  return positionIds[outcomeIndex as i32];
};

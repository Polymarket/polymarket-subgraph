/* eslint-disable @typescript-eslint/ban-types */
import {
  Address,
  crypto,
  BigInt,
  Bytes,
  ByteArray,
} from '@graphprotocol/graph-ts';
import { log } from 'matchstick-as/assembly/log';
import { ConditionalTokens } from '../types/ConditionalTokens/ConditionalTokens';

// declare type u64 = number;
// declare type i64 = number;
// declare type u32 = number;
// declare type i32 = number;

/**
 * Computes a positionId from a collateral token and a collectionId
 * @dev computes the positionId as keccak256(collateralToken + collectionId)
 * @param collateral
 * @param collectionId
 * @returns
 */
const computePositionId = (collateral: string, collectionId: Bytes): BigInt => {
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
  return BigInt.fromByteArray(
    crypto.keccak256(Bytes.fromUint8Array(hashPayload)),
  );
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

// const calculateCollectionId = (
//   conditionalTokenAddress: string,
//   conditionIds: string,
//   outcomeIndex: number,
// ): Bytes => {
//   const indexSet = BigInt.fromI32(1 << outcomeIndex);
// };

// function addMod(a: u64, b: u64, mod: u32): u32 {
//   return (a + b) % mod;
// }

// function mulMod(a: u64, b: u64, mod: u32): u32 {
//   return (u64(a) * u64(b)) % mod;
// }

// export function concat(a: ByteArray, b: ByteArray): ByteArray {
//   const out = new Uint8Array(a.length + b.length);
//   for (let i = 0; i < a.length; i++) {
//     out[i] = a[i];
//   }
//   for (let j = 0; j < b.length; j++) {
//     out[a.length + j] = b[j];
//   }
//   return changetype<ByteArray>(out);
// }

const P = BigInt.fromString(
  '21888242871839275222246405745257275088696311157297823662689037894645226208583',
);
const B = BigInt.fromI32(3);

const addModP = (a: BigInt, b: BigInt): BigInt => a.plus(b).mod(P);
const mulModP = (a: BigInt, b: BigInt): BigInt => a.times(b).mod(P);
const powModP = (a: BigInt, b: BigInt): BigInt => {
  // assume b is in uint256 range
  // first we check how big b is
  let bitLength = 0;
  let tmp = b;
  while (!tmp.isZero()) {
    bitLength++;
    tmp = tmp.rightShift(1);
  }

  // then we compute a^b
  // using binary expansion of b
  // b = b_0 + b_1 * 2 + b_2 * 2^2 + ... + b_n * 2^n
  // so a^b = a^(b_0) * a^(b_1 * 2) * a^(b_2 * 2^2) * ... * a^(b_n * 2^n)
  // = a^(b_0) * (a^2)^(b_1) * (a^4)^(b_2) * ... * (a^(2^n))^(b_n)
  let at = a;
  let bt = b;
  let result = BigInt.fromI32(1);

  for (let i = 0; i < bitLength; i++) {
    if (!bt.mod(BigInt.fromI32(2)).isZero()) {
      result = mulModP(result, at);
    }

    at = mulModP(at, at);
    bt = bt.rightShift(1);
  }

  return result;
};
const legendreSymbol = (a: BigInt): BigInt =>
  powModP(a, P.minus(BigInt.fromI32(1)).rightShift(1));

export function getCollectionId2(conditionId: Bytes, outcomeIndex: u8): Bytes {
  const indexSet = BigInt.fromI32(1).leftShift(outcomeIndex - 1);
  const hashPayload = new Uint8Array(64);
  hashPayload.fill(0);

  for (let i = 0; i < 32; i++) {
    hashPayload[i] = conditionId[i];
  }

  hashPayload[63] = indexSet.toI32();

  let x1 = BigInt.fromByteArray(
    crypto.keccak256(Bytes.fromUint8Array(hashPayload)),
  );

  const odd = !x1.rightShift(255).isZero();
  let y1 = BigInt.fromI32(0);
  let yy = BigInt.fromI32(0);

  // increment x1 until we find a point on the curve
  // i.e. if there exists y1 so y1^2 = x1^3 + 3 (mod P)
  do {
    x1 = addModP(x1, BigInt.fromI32(1));
    yy = addModP(mulModP(x1, mulModP(x1, x1)), B);
    y1 = yy.sqrt();
  } while (mulModP(y1, y1) != yy);

  if (
    (odd && y1.mod(BigInt.fromI32(2)).isZero()) ||
    (!odd && !y1.mod(BigInt.fromI32(2)).isZero())
  ) {
    y1 = P.minus(y1);
  }

  if (!y1.mod(BigInt.fromI32(2)).isZero()) {
    const x1_ = ByteArray.fromHexString(x1.toHex().padStart(64, '0'));
    x1_[0] ^= x1_[0] | 0x01;
    x1 = BigInt.fromByteArray(x1_);
  }

  return Bytes.fromByteArray(ByteArray.fromBigInt(x1));
}

export function getCollectionId3(conditionId: Bytes, outcomeIndex: u8): Bytes {
  log.info('start', []);
  // const indexSet = BigInt.fromI32(1).leftShift(outcomeIndex);
  const hashPayload = new Uint8Array(64);
  hashPayload.fill(0);

  for (let i = 0; i < 32; i++) {
    hashPayload[i] = conditionId[i];
  }

  hashPayload[63] = 1 << outcomeIndex;

  log.info(`${Bytes.fromUint8Array(hashPayload).toHexString()}`, []);

  const hashResult = crypto.keccak256(Bytes.fromUint8Array(hashPayload));
  // log.info(`${hashResult.toHexString()}`, []);
  // log.info(
  //   `${BigInt.fromUnsignedBytes(
  //     changetype<Bytes>(hashResult.reverse()),
  //   ).toString()}`,
  //   [],
  // );
  // let paddedResult = new ByteArray(1);
  // paddedResult[0] = 0x00;
  // paddedResult = paddedResult.concat(hashResult);
  hashResult.reverse();
  const hashBigInt = BigInt.fromByteArray(hashResult);
  log.info(`${hashBigInt.toString()}`, []);

  const odd = !hashBigInt.bitAnd(BigInt.fromI32(1).leftShift(255)).isZero();

  let x1 = addModP(
    P.leftShift(8), // P * 256, just in case
    hashBigInt,
  );

  let yy = BigInt.fromI32(0);
  log.info(`${x1.toString()}`, []);
  // log.info(`${x1.toString()}`, [x.toString()]);
  // increment x1 until we find a point on the curve
  // i.e. if there exists y1 so y1^2 = x1^3 + 3 (mod P)
  do {
    x1 = addModP(x1, BigInt.fromI32(1));
    yy = addModP(mulModP(x1, mulModP(x1, x1)), B);
  } while (legendreSymbol(yy) != BigInt.fromI32(1));

  log.info(`${yy.toString()}`, []);
  log.info(`${x1.toString()}`, []);
  // // now yy is a square
  // let a = P.minus(BigInt.fromI32(2));
  // let z = BigInt.fromI32(0);
  // do {
  //   a = addModP(a, BigInt.fromI32(1));
  //   z = addModP(mulModP(a, a), P.minus(BigInt.fromI32(yy)));
  // } while (legendreSymbol(z) == BigInt.fromI32(1));

  // now a^2 - yy is not a square.

  // if (
  //   (odd && y1.mod(BigInt.fromI32(2)).isZero()) ||
  //   (!odd && !y1.mod(BigInt.fromI32(2)).isZero())
  // ) {
  //   y1 = P.minus(y1);
  // }

  // if (!y1.mod(BigInt.fromI32(2)).isZero()) {
  //   x1 = addModP(x1, BigInt.fromI32(1).leftShift(254));
  // }

  if (odd) {
    log.info('odd', []);
    x1 = x1.plus(BigInt.fromI32(1).leftShift(254));
  }

  const result = Bytes.fromUint8Array(ByteArray.fromBigInt(x1).reverse());

  log.info(`${result.toHexString()}`, []);
  return result;
}

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
    const positionId = computePositionId(collateral, collectionId);
    const positionIdStr = hexToDecimalString(positionId.toString());
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

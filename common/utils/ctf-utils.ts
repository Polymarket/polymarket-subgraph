/* eslint-disable @typescript-eslint/ban-types */

import { Address, crypto, BigInt, Bytes } from '@graphprotocol/graph-ts';

const P = BigInt.fromString(
  '21888242871839275222246405745257275088696311157297823662689037894645226208583',
);
const B = BigInt.fromI32(3);

const addModP = (a: BigInt, b: BigInt): BigInt => a.plus(b).mod(P);
const mulModP = (a: BigInt, b: BigInt): BigInt => a.times(b).mod(P);
const powModP = (a: BigInt, b: BigInt): BigInt => {
  // assume b is in uint256 range

  // then we compute a^b
  // using binary expansion of b
  // b = b_0 + b_1 * 2 + b_2 * 2^2 + ... + b_n * 2^n
  // so a^b = a^(b_0) * a^(b_1 * 2) * a^(b_2 * 2^2) * ... * a^(b_n * 2^n)
  // = a^(b_0) * (a^2)^(b_1) * (a^4)^(b_2) * ... * (a^(2^n))^(b_n)
  let at = a;
  let bt = b;
  let result = BigInt.fromI32(1);

  while (bt.isZero() == false) {
    if (bt.bitAnd(BigInt.fromI32(1)).isZero() == false) {
      result = mulModP(result, at);
    }

    at = mulModP(at, at);
    bt = bt.rightShift(1);
  }

  return result;
};

// a^((P-1)/2) mod P
const legendreSymbol = (a: BigInt): BigInt =>
  powModP(a, P.minus(BigInt.fromI32(1)).rightShift(1));

// original implementation: https://github.com/gnosis/conditional-tokens-contracts/blob/master/contracts/CTHelpers.sol
// (ignoring the parent collection id)
const computeCollectionId = (
  conditionId: Bytes,
  // @ts-expect-error Cannot find name 'u8'.
  outcomeIndex: u8,
): Bytes => {
  const hashPayload = new Uint8Array(64);
  hashPayload.fill(0x00);

  // first 32 bytes is conditionId
  for (let i = 0; i < 32; i++) {
    hashPayload[i] = conditionId[i];
  }
  // second 32 bytes is index set
  hashPayload[63] = BigInt.fromI32(1).leftShift(outcomeIndex).toI32();
  const hashResult = crypto.keccak256(Bytes.fromUint8Array(hashPayload));

  // always reverse before converting to BigInt
  hashResult.reverse();
  const hashBigInt = BigInt.fromUnsignedBytes(hashResult);

  // check if the msb is set
  const odd = hashBigInt.rightShift(255).isZero() == false;

  let x1 = hashBigInt;
  let yy = BigInt.fromI32(0);

  // increment x1 until we find a point on the curve
  // i.e. if there exists y1 so y1^2 = x1^3 + 3 (mod P)
  // if the legendreSymbol is not 1, then the number is not a quadratic residue
  // i.e., its not a square mod P, and its not on the curve
  do {
    x1 = addModP(x1, BigInt.fromI32(1));
    yy = addModP(mulModP(x1, mulModP(x1, x1)), B);
  } while (legendreSymbol(yy) != BigInt.fromI32(1));

  const oddToggle = BigInt.fromI32(1).leftShift(254);
  if (odd) {
    if (x1.bitAnd(oddToggle).isZero()) {
      x1 = x1.plus(oddToggle);
    } else {
      x1 = x1.minus(oddToggle);
    }
  }

  let x1Hex = x1.toHexString();

  // pad x1 with zeroes
  if (x1Hex.length < 66) {
    x1Hex = '0x' + '0'.repeat(66 - x1Hex.length) + x1Hex.slice(2);
  }

  const result = Bytes.fromHexString(x1Hex);
  return result;
};

/**
 * Computes a positionId from a collateral token and a collectionId
 * @dev computes the positionId as keccak256(collateralToken + collectionId)
 * @param collateral
 * @param collectionId
 * @returns
 */
const computePositionIdFromCollectionId = (
  collateral: Address,
  collectionId: Bytes,
): BigInt => {
  let hashPayload = new Uint8Array(52);
  hashPayload.fill(0);

  // 20 bytes for the token address
  for (let i = 0; i < collateral.length && i < 20; i++) {
    hashPayload[i] = collateral[i];
  }

  // 32 bytes for the collectionId
  for (let i = 0; i < collectionId.length && i < 32; i++) {
    hashPayload[i + 20] = collectionId[i];
  }

  const byteArray = crypto.keccak256(Bytes.fromUint8Array(hashPayload));
  byteArray.reverse();

  return BigInt.fromUnsignedBytes(byteArray);
};

const computePositionId = (
  collateral: Address,
  conditionId: Bytes,
  // @ts-expect-error Cannot find name 'u8'.
  outcomeIndex: u8,
): BigInt => {
  const collectionId = computeCollectionId(conditionId, outcomeIndex);
  return computePositionIdFromCollectionId(collateral, collectionId);
};

export { computePositionId, computeCollectionId };

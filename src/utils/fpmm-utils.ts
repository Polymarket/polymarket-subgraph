/* eslint-disable no-param-reassign */
import { BigInt, BigDecimal } from '@graphprotocol/graph-ts';
import { FixedProductMarketMaker, FpmmPoolMembership } from '../types/schema';
import { timestampToDay } from './day-volume-utils';
import { bigOne, bigZero } from './constants';

export function loadPoolMembership(
  fpmmAddress: string,
  userAddress: string,
): FpmmPoolMembership {
  let poolMembershipId = fpmmAddress.concat(userAddress);
  let poolMembership = FpmmPoolMembership.load(poolMembershipId);
  if (poolMembership == null) {
    poolMembership = new FpmmPoolMembership(poolMembershipId);
    poolMembership.pool = fpmmAddress;
    poolMembership.funder = userAddress;
    poolMembership.amount = bigZero;
  }
  return poolMembership as FpmmPoolMembership;
}

/**
 * Computes the price of each outcome token given their holdings. Returns an array of numbers in the range [0, 1]
 * Credits to: https://github.com/protofire/gnosis-conditional-exchange
 */
export function calculatePrices(outcomeTokenAmounts: BigInt[]): BigDecimal[] {
  let outcomePrices = new Array<BigDecimal>(outcomeTokenAmounts.length);

  let totalTokensBalance = bigZero;
  let product = bigOne;
  for (let i = 0; i < outcomeTokenAmounts.length; i += 1) {
    totalTokensBalance = totalTokensBalance.plus(outcomeTokenAmounts[i]);
    product = product.times(outcomeTokenAmounts[i]);
  }

  // If there are no tokens in the market maker then return a zero price for everything
  if (totalTokensBalance.equals(bigZero)) {
    return outcomePrices;
  }

  let denominator = bigZero;
  for (let i = 0; i < outcomeTokenAmounts.length; i += 1) {
    denominator = denominator.plus(product.div(outcomeTokenAmounts[i]));
  }

  for (let i = 0; i < outcomeTokenAmounts.length; i += 1) {
    outcomePrices[i] = product
      .divDecimal(outcomeTokenAmounts[i].toBigDecimal())
      .div(denominator.toBigDecimal());
  }
  return outcomePrices;
}

export function updateVolumes(
  fpmm: FixedProductMarketMaker,
  timestamp: BigInt,
  tradeSize: BigInt,
  collateralScaleDec: BigDecimal,
): void {
  let currentDay = timestampToDay(timestamp);

  if (fpmm.lastActiveDay.notEqual(currentDay)) {
    fpmm.lastActiveDay = currentDay;
  }

  fpmm.collateralVolume = fpmm.collateralVolume.plus(tradeSize);
  fpmm.scaledCollateralVolume = fpmm.collateralVolume.divDecimal(
    collateralScaleDec,
  );
}

export function updateLiquidityFields(
  fpmm: FixedProductMarketMaker,
  liquidityParameter: BigInt,
  collateralScale: BigDecimal,
): void {
  fpmm.liquidityParameter = liquidityParameter;
  fpmm.scaledLiquidityParameter = liquidityParameter.divDecimal(
    collateralScale,
  );
}

export function updateFeeFields(
  fpmm: FixedProductMarketMaker,
  feeAmount: BigInt,
  collateralScale: BigDecimal,
): void {
  fpmm.feeVolume = fpmm.feeVolume.plus(feeAmount);
  fpmm.scaledFeeVolume = fpmm.feeVolume.divDecimal(collateralScale);
}

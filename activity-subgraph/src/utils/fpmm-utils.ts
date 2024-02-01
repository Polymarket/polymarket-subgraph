/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable no-param-reassign */
import { BigInt, BigDecimal } from '@graphprotocol/graph-ts';
import { FixedProductMarketMaker, FpmmPoolMembership } from '../types/schema';
import { timestampToDay } from './time';
import { bigOne, bigZero, TRADE_TYPE_BUY, TRADE_TYPE_SELL } from './constants';
import { COLLATERAL_SCALE_DEC } from '../../../common/constants';

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
  outcomePrices.fill(BigDecimal.zero());

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
  tradeType: string,
): void {
  let currentDay = timestampToDay(timestamp);

  if (fpmm.lastActiveDay.notEqual(currentDay)) {
    fpmm.lastActiveDay = currentDay;
  }

  fpmm.collateralVolume = fpmm.collateralVolume.plus(tradeSize);
  fpmm.scaledCollateralVolume =
    fpmm.collateralVolume.divDecimal(COLLATERAL_SCALE_DEC);

  if (tradeType == TRADE_TYPE_BUY) {
    fpmm.collateralBuyVolume = fpmm.collateralBuyVolume.plus(tradeSize);
    fpmm.scaledCollateralBuyVolume =
      fpmm.collateralBuyVolume.divDecimal(COLLATERAL_SCALE_DEC);
  } else if (tradeType == TRADE_TYPE_SELL) {
    fpmm.collateralSellVolume = fpmm.collateralSellVolume.plus(tradeSize);
    fpmm.scaledCollateralSellVolume =
      fpmm.collateralSellVolume.divDecimal(COLLATERAL_SCALE_DEC);
  }
}

export function updateLiquidityFields(
  fpmm: FixedProductMarketMaker,
  liquidityParameter: BigInt,
): void {
  fpmm.liquidityParameter = liquidityParameter;
  fpmm.scaledLiquidityParameter =
    liquidityParameter.divDecimal(COLLATERAL_SCALE_DEC);
}

export function updateFeeFields(
  fpmm: FixedProductMarketMaker,
  feeAmount: BigInt,
): void {
  fpmm.feeVolume = fpmm.feeVolume.plus(feeAmount);
  fpmm.scaledFeeVolume = fpmm.feeVolume.divDecimal(COLLATERAL_SCALE_DEC);
}

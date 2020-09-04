import { BigInt, Address, BigDecimal } from '@graphprotocol/graph-ts'
import { FixedProductMarketMaker } from "../../generated/schema";
import { ERC20Detailed } from "../../generated/templates/ERC20Detailed/ERC20Detailed"
import { timestampToDay, joinDayAndVolume, joinDayAndScaledVolume } from './day-volume-utils';

export function getCollateralScale(collateralTokenAddress: Address): BigInt {
  let collateralToken = ERC20Detailed.bind(collateralTokenAddress);
  let result = collateralToken.try_decimals();

  return result.reverted ?
    BigInt.fromI32(1) :
    BigInt.fromI32(10).pow(<u8>result.value);
}

/**
 * Computes the price of each outcome token given their holdings. Returns an array of numbers in the range [0, 1]
 * Credits to: https://github.com/protofire/gnosis-conditional-exchange
 */
export function calculatePrices(outcomeTokenAmounts: BigInt[]): BigDecimal[] {
  let outcomePrices = new Array<BigDecimal>(outcomeTokenAmounts.length);

  let totalTokensBalance = BigInt.fromI32(0);
  let product = BigInt.fromI32(1);
  for(let i = 0; i < outcomeTokenAmounts.length; i++) {
    totalTokensBalance = totalTokensBalance.plus(outcomeTokenAmounts[i]);
    product = product.times(outcomeTokenAmounts[i]);
  }

  // If there are no tokens in the market maker then return a zero price for everything
  if (totalTokensBalance.equals(BigInt.fromI32(0))) {
    return outcomePrices
  }

  let denominator = BigInt.fromI32(0);
  for(let i = 0; i < outcomeTokenAmounts.length; i++) {
    denominator = denominator.plus(product.div(outcomeTokenAmounts[i]));
  }

  for(let i = 0; i < outcomeTokenAmounts.length; i++) {
    outcomePrices[i] = product.divDecimal(outcomeTokenAmounts[i].toBigDecimal()).div(denominator.toBigDecimal());
  }
  return outcomePrices
}

export function updateVolumes (
  fpmm: FixedProductMarketMaker,
  timestamp: BigInt,
  tradeSize: BigInt,
  collateralScale: BigInt,
  collateralScaleDec: BigDecimal
): void {
  
  let currentDay = timestampToDay(timestamp);

  if (fpmm.lastActiveDay.notEqual(currentDay)) {
    fpmm.lastActiveDay = currentDay;
    fpmm.collateralVolumeBeforeLastActiveDay = fpmm.collateralVolume;
  }

  fpmm.collateralVolume = fpmm.collateralVolume.plus(tradeSize);
  fpmm.runningDailyVolume = fpmm.collateralVolume.minus(fpmm.collateralVolumeBeforeLastActiveDay);
  fpmm.lastActiveDayAndRunningDailyVolume = joinDayAndVolume(currentDay, fpmm.runningDailyVolume);

  updateScaledVolumes(fpmm as FixedProductMarketMaker, collateralScale, collateralScaleDec, currentDay);  
}

// We export updatedScaledVolumes so that it can be used in the FPMMDeterministicFactoryMapping to initialise the values
// On any further updates we allow use updateVolumes which will automatically call this.
export function updateScaledVolumes(
  fpmm: FixedProductMarketMaker,
  collateralScale: BigInt,
  collateralScaleDec: BigDecimal,
  currentDay: BigInt,
): void {
  fpmm.scaledCollateralVolume = fpmm.collateralVolume.divDecimal(collateralScaleDec);
  fpmm.scaledRunningDailyVolume = fpmm.runningDailyVolume.divDecimal(collateralScaleDec);
  
  fpmm.lastActiveDayAndScaledRunningDailyVolume = joinDayAndScaledVolume(
    currentDay,
    fpmm.runningDailyVolume,
    collateralScale
  );
}

export function updateLiquidityFields(
  fpmm: FixedProductMarketMaker,
  liquidityParameter: BigInt,
  collateralScale: BigDecimal,
): void {
  fpmm.liquidityParameter = liquidityParameter;
  fpmm.scaledLiquidityParameter = liquidityParameter.divDecimal(collateralScale);
}

export function updateFeeFields(
  fpmm: FixedProductMarketMaker,
  feeAmount: BigInt,
  collateralScale: BigDecimal,
): void {
  fpmm.feeVolume = fpmm.feeVolume.plus(feeAmount);
  fpmm.scaledFeeVolume = fpmm.feeVolume.divDecimal(collateralScale);
}

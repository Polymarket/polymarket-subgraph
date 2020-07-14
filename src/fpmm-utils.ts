import { BigInt, Address, BigDecimal } from '@graphprotocol/graph-ts'
import { FixedProductMarketMaker } from "../generated/schema";
import { ERC20Detailed } from "../generated/templates/ERC20Detailed/ERC20Detailed"
import { joinDayAndScaledVolume } from './day-volume-utils';

export function getCollateralScale(collateralTokenAddress: Address): BigInt {
  let collateralToken = ERC20Detailed.bind(collateralTokenAddress);
  let result = collateralToken.try_decimals();

  return result.reverted ?
    BigInt.fromI32(1) :
    BigInt.fromI32(10).pow(<u8>result.value);
}

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

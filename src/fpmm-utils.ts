import { BigInt, Address, BigDecimal } from '@graphprotocol/graph-ts'
import { FixedProductMarketMaker } from "../generated/schema";
import { ERC20Detailed } from "../generated/templates/ERC20Detailed/ERC20Detailed"
import { joinDayAndScaledVolume } from './day-volume-utils';

export function updateScaledVolumes(fpmm: FixedProductMarketMaker, currentDay: BigInt): void {
  let collateralToken = ERC20Detailed.bind(fpmm.collateralToken as Address);
  let result = collateralToken.try_decimals();

  let collateralScale: BigDecimal = result.reverted ?
    BigInt.fromI32(1).toBigDecimal() :
    BigInt.fromI32(10).pow(<u8>result.value).toBigDecimal();

  fpmm.scaledCollateralVolume = fpmm.collateralVolume.divDecimal(collateralScale);
  fpmm.scaledRunningDailyVolume = fpmm.runningDailyVolume.divDecimal(collateralScale);
  fpmm.lastActiveDayAndScaledRunningDailyVolume = joinDayAndScaledVolume(currentDay, fpmm.scaledRunningDailyVolume);
}
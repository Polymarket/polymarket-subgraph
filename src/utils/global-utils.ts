import { BigDecimal, BigInt } from '@graphprotocol/graph-ts';
import { Global } from '../types/schema';
import { bigZero } from './constants';

export function requireGlobal(): Global {
  let global = Global.load('');
  if (global == null) {
    global = new Global('');
    global.numConditions = 0;
    global.numOpenConditions = 0;
    global.numClosedConditions = 0;

    global.usdcVolume = bigZero;
    global.scaledUsdcVolume = bigZero.toBigDecimal();
    global.usdcFees = bigZero;
    global.scaledUsdcFees = bigZero.toBigDecimal();
  }
  return global as Global;
}

export function updateGlobalVolume(
  tradeAmount: BigInt,
  feesAmount: BigInt,
  collateralScaleDec: BigDecimal,
): void {
  let global = requireGlobal();
  global.usdcVolume = global.usdcVolume.plus(tradeAmount);
  global.scaledUsdcVolume = global.usdcVolume.divDecimal(collateralScaleDec);
  global.usdcFees = global.usdcVolume.plus(feesAmount);
  global.scaledUsdcFees = global.usdcFees.divDecimal(collateralScaleDec);
  global.save();
}

import { BigDecimal, BigInt } from '@graphprotocol/graph-ts';
import { Global } from '../types/schema';
import { bigOne, bigZero, TRADE_TYPE_BUY, TRADE_TYPE_SELL } from './constants';

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
  tradeType: string,
): void {
  let global = requireGlobal();
  global.usdcVolume = global.usdcVolume.plus(tradeAmount);
  global.scaledUsdcVolume = global.usdcVolume.divDecimal(collateralScaleDec);
  global.usdcFees = global.usdcVolume.plus(feesAmount);
  global.scaledUsdcFees = global.usdcFees.divDecimal(collateralScaleDec);
  global.tradesQuantity = global.tradesQuantity.plus(bigOne);
  if (tradeType == TRADE_TYPE_BUY) {
    global.buysQuantity = global.buysQuantity.plus(bigOne);
  } else if (tradeType == TRADE_TYPE_SELL) {
    global.sellsQuantity = global.sellsQuantity.plus(bigOne);
  }
  global.save();
}

/* eslint-disable @typescript-eslint/ban-types */

import { BigInt } from '@graphprotocol/graph-ts';
import { Global } from '../types/schema';
import { bigZero, TRADE_TYPE_BUY, TRADE_TYPE_SELL } from './constants';
import { increment } from './maths';
import { COLLATERAL_SCALE_DEC } from '../../../common/constants';

export function requireGlobal(): Global {
  let global = Global.load('');
  if (global == null) {
    global = new Global('');
    global.numConditions = 0;
    global.numOpenConditions = 0;
    global.numClosedConditions = 0;

    global.numTraders = bigZero;

    global.tradesQuantity = bigZero;
    global.buysQuantity = bigZero;
    global.sellsQuantity = bigZero;

    global.collateralVolume = bigZero;
    global.scaledCollateralVolume = bigZero.toBigDecimal();
    global.collateralFees = bigZero;
    global.scaledCollateralFees = bigZero.toBigDecimal();

    global.collateralBuyVolume = bigZero;
    global.scaledCollateralBuyVolume = bigZero.toBigDecimal();
    global.collateralSellVolume = bigZero;
    global.scaledCollateralSellVolume = bigZero.toBigDecimal();
  }
  return global as Global;
}

export function countNewTrader(): void {
  let global = requireGlobal();
  global.numTraders = increment(global.numTraders);
  global.save();
}

export function updateGlobalVolume(
  tradeAmount: BigInt,
  feesAmount: BigInt,
  tradeType: string,
): void {
  let global = requireGlobal();
  global.collateralVolume = global.collateralVolume.plus(tradeAmount);
  global.scaledCollateralVolume =
    global.collateralVolume.divDecimal(COLLATERAL_SCALE_DEC);
  global.collateralFees = global.collateralFees.plus(feesAmount);
  global.scaledCollateralFees =
    global.collateralFees.divDecimal(COLLATERAL_SCALE_DEC);
  global.tradesQuantity = increment(global.tradesQuantity);
  if (tradeType == TRADE_TYPE_BUY) {
    global.buysQuantity = increment(global.buysQuantity);
    global.collateralBuyVolume = global.collateralBuyVolume.plus(tradeAmount);
    global.scaledCollateralBuyVolume =
      global.collateralBuyVolume.divDecimal(COLLATERAL_SCALE_DEC);
  } else if (tradeType == TRADE_TYPE_SELL) {
    global.sellsQuantity = increment(global.sellsQuantity);
    global.collateralSellVolume = global.collateralSellVolume.plus(tradeAmount);
    global.scaledCollateralSellVolume =
      global.collateralSellVolume.divDecimal(COLLATERAL_SCALE_DEC);
  }
  global.save();
}

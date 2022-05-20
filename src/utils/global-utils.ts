import { BigDecimal, BigInt } from '@graphprotocol/graph-ts';
import { Global } from '../types/schema';
import {
  ADD_FUNDING,
  bigZero,
  REMOVE_FUNDING,
  TRADE_TYPE_BUY,
  TRADE_TYPE_SELL,
} from './constants';
import { increment } from './maths';

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
    global.liquidity = bigZero;
    global.scaledLiquidity = bigZero.toBigDecimal();
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
  collateralScaleDec: BigDecimal,
  tradeType: string,
): void {
  let global = requireGlobal();
  global.collateralVolume = global.collateralVolume.plus(tradeAmount);
  global.scaledCollateralVolume = global.collateralVolume.divDecimal(
    collateralScaleDec,
  );
  global.collateralFees = global.collateralFees.plus(feesAmount);
  global.scaledCollateralFees = global.collateralFees.divDecimal(
    collateralScaleDec,
  );
  global.tradesQuantity = increment(global.tradesQuantity);
  if (tradeType == TRADE_TYPE_BUY) {
    global.buysQuantity = increment(global.buysQuantity);
    global.collateralBuyVolume = global.collateralBuyVolume.plus(tradeAmount);
    global.scaledCollateralBuyVolume = global.collateralBuyVolume.divDecimal(
      collateralScaleDec,
    );
  } else if (tradeType == TRADE_TYPE_SELL) {
    global.sellsQuantity = increment(global.sellsQuantity);
    global.collateralSellVolume = global.collateralSellVolume.plus(tradeAmount);
    global.scaledCollateralSellVolume = global.collateralSellVolume.divDecimal(
      collateralScaleDec,
    );
  }
  global.save();
}

export function updateGlobalLiquidity(
  amount: BigInt,
  collateralScaleDec: BigDecimal,
  transactionType: string,
): void {
  let global = requireGlobal();

  if (transactionType == ADD_FUNDING) {
    global.liquidity = global.liquidity.plus(amount);
    global.scaledLiquidity = global.liquidity.divDecimal(collateralScaleDec);
  } else if (transactionType == REMOVE_FUNDING) {
    global.liquidity = global.liquidity.minus(amount);
    global.scaledLiquidity = global.liquidity.divDecimal(collateralScaleDec);
  }
  global.save();
}

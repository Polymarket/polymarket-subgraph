import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { FilledOrderBook, FilledOrderGlobal } from "../types/schema";
import { bigZero, TRADE_TYPE_LIMIT_BUY, TRADE_TYPE_LIMIT_SELL } from "./constants";
import { increment } from "./maths";
import { timestampToDay } from "./time";

export function requireOrderBook(tokenId:string): FilledOrderBook {
  let orderBook = FilledOrderBook.load(tokenId)

  if (orderBook == null) {
    orderBook = new FilledOrderBook(tokenId)

    orderBook.buys = [] as string[]
    orderBook.sells = [] as string[]

    orderBook.tradesQuantity = bigZero;
    orderBook.buysQuantity = bigZero;
    orderBook.sellsQuantity = bigZero;

    orderBook.collateralVolume = bigZero;
    orderBook.scaledCollateralVolume = bigZero.toBigDecimal();
    orderBook.collateralBuyVolume = bigZero;
    orderBook.scaledCollateralBuyVolume = bigZero.toBigDecimal();
    orderBook.collateralSellVolume = bigZero;
    orderBook.scaledCollateralSellVolume = bigZero.toBigDecimal()

    orderBook.feeVolume = bigZero;
    orderBook.scaledFeeVolume = bigZero.toBigDecimal()

    orderBook.lastActiveDay = bigZero
  }

  return orderBook as FilledOrderBook;
} 

export function updateVolumes(
  orderBook: FilledOrderBook,
  timestamp: BigInt,
  tradeSize: BigInt,
  collateralScaleDec: BigDecimal,
  tradeType: string,
): void {
  let currentDay = timestampToDay(timestamp);

  if (orderBook.lastActiveDay.notEqual(currentDay)) {
    orderBook.lastActiveDay = currentDay;
  }

  orderBook.collateralVolume = orderBook.collateralVolume.plus(tradeSize);
  orderBook.scaledCollateralVolume = orderBook.collateralVolume.divDecimal(
    collateralScaleDec,
  );

  if (tradeType == TRADE_TYPE_LIMIT_BUY) {
    orderBook.collateralBuyVolume = orderBook.collateralBuyVolume.plus(tradeSize);
    orderBook.scaledCollateralBuyVolume = orderBook.collateralBuyVolume.divDecimal(
      collateralScaleDec,
    );
  } else if (tradeType == TRADE_TYPE_LIMIT_SELL) {
    orderBook.collateralSellVolume = orderBook.collateralSellVolume.plus(tradeSize);
    orderBook.scaledCollateralSellVolume = orderBook.collateralSellVolume.divDecimal(
      collateralScaleDec,
    );
  }
}

export function updateFeeFields(
  orderBook: FilledOrderBook,
  feeAmount: BigInt,
  collateralScaleDec: BigDecimal,
): void {
  orderBook.feeVolume = orderBook.feeVolume.plus(feeAmount);
  orderBook.scaledFeeVolume = orderBook.feeVolume.divDecimal(collateralScaleDec);
}

export function requireGlobal(): FilledOrderGlobal {
  let global = FilledOrderGlobal.load('');
  if (global == null) {
    global = new FilledOrderGlobal('');

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
  return global as FilledOrderGlobal;
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
  if (tradeType == TRADE_TYPE_LIMIT_BUY) {
    global.buysQuantity = increment(global.buysQuantity);
    global.collateralBuyVolume = global.collateralBuyVolume.plus(tradeAmount);
    global.scaledCollateralBuyVolume = global.collateralBuyVolume.divDecimal(
      collateralScaleDec,
    );
  } else if (tradeType == TRADE_TYPE_LIMIT_SELL) {
    global.sellsQuantity = increment(global.sellsQuantity);
    global.collateralSellVolume = global.collateralSellVolume.plus(tradeAmount);
    global.scaledCollateralSellVolume = global.collateralSellVolume.divDecimal(
      collateralScaleDec,
    );
  }
  global.save();
}


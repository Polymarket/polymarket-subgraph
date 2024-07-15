import { BigDecimal, BigInt } from '@graphprotocol/graph-ts';
import { Orderbook, OrdersMatchedGlobal } from '../types/schema';
import { bigZero, TRADE_TYPE_BUY, TRADE_TYPE_SELL } from './constants';
import { increment } from './maths';
import { timestampToDay } from './time';

export function requireOrderBook(tokenId: string): Orderbook {
  let orderBook = Orderbook.load(tokenId);

  if (orderBook == null) {
    orderBook = new Orderbook(tokenId);

    orderBook.tradesQuantity = bigZero;
    orderBook.buysQuantity = bigZero;
    orderBook.sellsQuantity = bigZero;

    orderBook.collateralVolume = bigZero;
    orderBook.scaledCollateralVolume = bigZero.toBigDecimal();
    orderBook.collateralBuyVolume = bigZero;
    orderBook.scaledCollateralBuyVolume = bigZero.toBigDecimal();
    orderBook.collateralSellVolume = bigZero;
    orderBook.scaledCollateralSellVolume = bigZero.toBigDecimal();

    orderBook.lastActiveDay = bigZero;
  }

  return orderBook as Orderbook;
}

export function requireGlobal(): OrdersMatchedGlobal {
  let global = OrdersMatchedGlobal.load('');
  if (global == null) {
    global = new OrdersMatchedGlobal('');

    global.tradesQuantity = bigZero;
    global.buysQuantity = bigZero;
    global.sellsQuantity = bigZero;

    global.collateralVolume = bigZero.toBigDecimal();
    global.scaledCollateralVolume = bigZero.toBigDecimal();

    global.collateralBuyVolume = bigZero.toBigDecimal();
    global.scaledCollateralBuyVolume = bigZero.toBigDecimal();
    global.collateralSellVolume = bigZero.toBigDecimal();
    global.scaledCollateralSellVolume = bigZero.toBigDecimal();
  }
  return global as OrdersMatchedGlobal;
}

export function updateVolumes(
  orderBook: Orderbook,
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
  orderBook.scaledCollateralVolume =
    orderBook.collateralVolume.divDecimal(collateralScaleDec);

  if (tradeType === TRADE_TYPE_BUY) {
    orderBook.collateralBuyVolume =
      orderBook.collateralBuyVolume.plus(tradeSize);
    orderBook.scaledCollateralBuyVolume =
      orderBook.collateralBuyVolume.divDecimal(collateralScaleDec);
  } else if (tradeType === TRADE_TYPE_SELL) {
    orderBook.collateralSellVolume =
      orderBook.collateralSellVolume.plus(tradeSize);
    orderBook.scaledCollateralSellVolume =
      orderBook.collateralSellVolume.divDecimal(collateralScaleDec);
  }
}

export function updateTradesQuantity(
  orderBook: Orderbook,
  side: string
): void {
  if (side === TRADE_TYPE_BUY) {
    orderBook.tradesQuantity = increment(orderBook.tradesQuantity);
    orderBook.buysQuantity = increment(orderBook.buysQuantity);
  } else if (side === TRADE_TYPE_SELL) {
    orderBook.tradesQuantity = increment(orderBook.tradesQuantity);
    orderBook.sellsQuantity = increment(orderBook.sellsQuantity);
  }
}

export function updateGlobalVolume(
  tradeAmount: BigDecimal,
  collateralScaleDec: BigDecimal,
  tradeType: string,
): void {
  let global = requireGlobal();
  global.collateralVolume = global.collateralVolume.plus(tradeAmount);
  global.scaledCollateralVolume =
    global.collateralVolume.div(collateralScaleDec);
  global.tradesQuantity = increment(global.tradesQuantity);
  if (tradeType === TRADE_TYPE_BUY) {
    global.buysQuantity = increment(global.buysQuantity);
    global.collateralBuyVolume = global.collateralBuyVolume.plus(tradeAmount);
    global.scaledCollateralBuyVolume =
      global.collateralBuyVolume.div(collateralScaleDec);
  } else if (tradeType === TRADE_TYPE_SELL) {
    global.sellsQuantity = increment(global.sellsQuantity);
    global.collateralSellVolume = global.collateralSellVolume.plus(tradeAmount);
    global.scaledCollateralSellVolume =
      global.collateralSellVolume.div(collateralScaleDec);
  }
  global.save();
}

export function getOrderSide(makerAssetId: BigInt): string {
  return makerAssetId.equals(bigZero) ? TRADE_TYPE_BUY : TRADE_TYPE_SELL;
}

export function getOrderSize(
  makerAmountFilled: BigInt,
  takerAmountFilled: BigInt,
  side: string,
): BigInt {
  if (side === TRADE_TYPE_BUY) {
    return makerAmountFilled;
  }
  return takerAmountFilled;
}

function normalizeAmounts(amount: BigInt): BigDecimal {
  let amtDecimal = new BigDecimal(amount);
  let t = new BigDecimal(BigInt.fromI32(10).pow(<u8>6));
  return amtDecimal.div(t);
}

export function getOrderPrice(
  makerAmountFilled: BigInt,
  takerAmountFilled: BigInt,
  side: string,
): BigDecimal {
  let price = BigDecimal.fromString('0');
  let quoteAssetAmount = BigDecimal.fromString('0');
  let baseAssetAmount = BigDecimal.fromString('0');
  let makerAmount = normalizeAmounts(makerAmountFilled);
  let takerAmount = normalizeAmounts(takerAmountFilled);

  if (side == TRADE_TYPE_BUY) {
    quoteAssetAmount = makerAmount;
    baseAssetAmount = takerAmount;
  } else {
    quoteAssetAmount = takerAmount;
    baseAssetAmount = makerAmount;
  }

  if (!baseAssetAmount.equals(BigDecimal.fromString('0'))) {
    price = quoteAssetAmount.div(baseAssetAmount);
  }

  return price;
}

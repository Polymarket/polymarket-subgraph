import { BigDecimal, BigInt } from '@graphprotocol/graph-ts';
import { Orderbook, OrdersMatchedGlobal } from '../types/schema';
import { bigOne, bigZero, TRADE_TYPE_BUY, TRADE_TYPE_SELL } from './constants';

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
    orderBook.tradesQuantity = orderBook.tradesQuantity.plus(bigOne);
    orderBook.buysQuantity = orderBook.buysQuantity.plus(bigOne);
  } else if (side === TRADE_TYPE_SELL) {
    orderBook.tradesQuantity = orderBook.tradesQuantity.plus(bigOne);
    orderBook.sellsQuantity = orderBook.sellsQuantity.plus(bigOne);
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
  global.tradesQuantity = global.tradesQuantity.plus(bigOne);
  if (tradeType === TRADE_TYPE_BUY) {
    global.buysQuantity = global.buysQuantity.plus(bigOne);
    global.collateralBuyVolume = global.collateralBuyVolume.plus(tradeAmount);
    global.scaledCollateralBuyVolume =
      global.collateralBuyVolume.div(collateralScaleDec);
  } else if (tradeType === TRADE_TYPE_SELL) {
    global.sellsQuantity = global.sellsQuantity.plus(bigOne);
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


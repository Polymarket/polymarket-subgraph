import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { OrderFilled } from "../types/LimitOrderProtocol/LimitOrderProtocol";
import { FilledOrderBook, FilledOrderGlobal } from "../types/schema";
import { getTokenDecimals } from "./collateralTokens";
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

    orderBook.lastActiveDay = bigZero
  }

  return orderBook as FilledOrderBook;
} 

export function requireGlobal(): FilledOrderGlobal {
  let global = FilledOrderGlobal.load('');
  if (global == null) {
    global = new FilledOrderGlobal('');

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
  return global as FilledOrderGlobal;
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

  if (tradeType === TRADE_TYPE_LIMIT_BUY) {
    orderBook.collateralBuyVolume = orderBook.collateralBuyVolume.plus(tradeSize);
    orderBook.scaledCollateralBuyVolume = orderBook.collateralBuyVolume.divDecimal(
      collateralScaleDec,
    );
  } else if (tradeType === TRADE_TYPE_LIMIT_SELL) {
    orderBook.collateralSellVolume = orderBook.collateralSellVolume.plus(tradeSize);
    orderBook.scaledCollateralSellVolume = orderBook.collateralSellVolume.divDecimal(
      collateralScaleDec,
    );
  }
}

export function updateTradesQuantity(
  orderBook: FilledOrderBook,
  side: string, 
  orderId:string,
): void {
  if (side === TRADE_TYPE_LIMIT_BUY) {
    if (orderBook.buys.indexOf(orderId) === -1) {
      orderBook.tradesQuantity = increment(orderBook.tradesQuantity);
      orderBook.buysQuantity = increment(orderBook.buysQuantity);
      orderBook.buys = orderBook.buys.concat(
        [orderId],
      );
    }
  } else if (side === TRADE_TYPE_LIMIT_SELL) {
    if (orderBook.sells.indexOf(orderId) === -1) {
      orderBook.tradesQuantity = increment(orderBook.tradesQuantity);
      orderBook.sellsQuantity = increment(orderBook.sellsQuantity);
      orderBook.sells = orderBook.sells.concat(
        [orderId],
      );
    }
  }
}

export function updateGlobalVolume(
  tradeAmount: BigDecimal,
  collateralScaleDec: BigDecimal,
  tradeType: string,
): void {
  let global = requireGlobal();
  global.collateralVolume = global.collateralVolume.plus(tradeAmount);
  global.scaledCollateralVolume = global.collateralVolume.div(
    collateralScaleDec,
  );
  global.tradesQuantity = increment(global.tradesQuantity);
  if (tradeType === TRADE_TYPE_LIMIT_BUY) {
    global.buysQuantity = increment(global.buysQuantity);
    global.collateralBuyVolume = global.collateralBuyVolume.plus(tradeAmount);
    global.scaledCollateralBuyVolume = global.collateralBuyVolume.div(
      collateralScaleDec,
    );
  } else if (tradeType === TRADE_TYPE_LIMIT_SELL) {
    global.sellsQuantity = increment(global.sellsQuantity);
    global.collateralSellVolume = global.collateralSellVolume.plus(tradeAmount);
    global.scaledCollateralSellVolume = global.collateralSellVolume.div(
      collateralScaleDec,
    );
  }
  global.save();
}

export function getOrderSide(makerAsset: Address): string {
  let d = getTokenDecimals(makerAsset as Address)
  return d > 0 ? TRADE_TYPE_LIMIT_BUY : TRADE_TYPE_LIMIT_SELL
}

export function getOrderSize(order: OrderFilled, side: string): BigInt {
  if (side === TRADE_TYPE_LIMIT_BUY) {
    return order.params.makerAmountFilled
  } else {
    return order.params.takerAmountFilled
  }
}

export function getOrderPrice(
  makerAmountFilled:BigInt, 
  takerAmountFilled:BigInt, 
  makerAsset: Address,
  takerAsset: Address,
  side: string,
): BigDecimal {
  let price = BigDecimal.fromString("0")
  let quoteAssetAmount = BigDecimal.fromString("0")
  let baseAssetAmount = BigDecimal.fromString("0")
  let makerAmount = normalizeAmounts(makerAmountFilled, makerAsset)
  let takerAmount = normalizeAmounts(takerAmountFilled, takerAsset)

  if (side == TRADE_TYPE_LIMIT_BUY) {
    quoteAssetAmount = makerAmount
    baseAssetAmount = takerAmount
  } else {
    quoteAssetAmount = takerAmount
    baseAssetAmount = makerAmount
  }

  if (!baseAssetAmount.equals(BigDecimal.fromString("0"))) {
    price = quoteAssetAmount.div(baseAssetAmount)
  }

  return price
}

function normalizeAmounts(amount: BigInt, address: Address): BigDecimal {
  let normalized = BigDecimal.fromString("0")
  let amtDecimal = new BigDecimal(amount)
  let collateralDecimals = getTokenDecimals(address)

  if (collateralDecimals > 0){
    let t = new BigDecimal(BigInt.fromI32(10).pow(<u8>collateralDecimals))
    normalized = amtDecimal.div(t)
  } else {    
    let t = new BigDecimal(BigInt.fromI32(10).pow(<u8>6))
    normalized = amtDecimal.div(t)
  }

  return normalized
}
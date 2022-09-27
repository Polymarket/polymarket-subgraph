import { BigDecimal, BigInt } from '@graphprotocol/graph-ts';
import { OrderFilled, OrdersMatched } from './types/Exchange/Exchange';
import {
  EnrichedOrderFilled,
  Orderbook,
  OrderFilledEvent,
  OrdersMatchedEvent,
} from './types/schema';
import { markAccountAsSeen, updateUserVolume } from './utils/account-utils';
import { bigZero, TRADE_TYPE_LIMIT_BUY } from './utils/constants';
import {
  getOrderPrice,
  getOrderSide,
  getOrderSize,
  requireOrderBook,
  updateGlobalVolume,
  updateTradesQuantity,
  updateVolumes,
} from './utils/order-book-utils';

function enrichOrder(
  event: OrderFilled,
  side: string,
  marketId: string,
): string {
  let eventId =
    event.transaction.hash.toHexString() +
    '_' +
    event.params.orderHash.toHexString();

  let enriched = new EnrichedOrderFilled(eventId);
  enriched.transactionHash = event.transaction.hash;
  enriched.timestamp = event.block.timestamp;
  enriched.maker = event.params.maker.toHexString();
  enriched.taker = event.params.taker.toHexString();
  enriched.orderHash = event.params.orderHash;
  enriched.market = marketId;
  enriched.side = side;
  enriched.size = getOrderSize(event, side);
  enriched.price = getOrderPrice(
    event.params.makerAmountFilled,
    event.params.takerAmountFilled,
    side,
  );

  enriched.save();

  return eventId;
}

function recordOrderFilledEvent(event: OrderFilled): string {
  let eventId =
    event.transaction.hash.toHexString() +
    '_' +
    event.params.orderHash.toHexString();

  let orderFilledEvent = new OrderFilledEvent(eventId);
  orderFilledEvent.transactionHash = event.transaction.hash;
  orderFilledEvent.timestamp = event.block.timestamp;
  orderFilledEvent.orderHash = event.params.orderHash;
  orderFilledEvent.maker = event.params.maker.toHexString();
  orderFilledEvent.taker = event.params.taker.toHexString();
  orderFilledEvent.makerAssetId = event.params.makerAssetId;
  orderFilledEvent.takerAssetId = event.params.takerAssetId;
  orderFilledEvent.makerAmountFilled = event.params.makerAmountFilled;
  orderFilledEvent.takerAmountFilled = event.params.takerAmountFilled;
  orderFilledEvent.fee = event.params.fee;
  orderFilledEvent.save();

  return eventId;
}

/*
OrderFilled - used to calculate side, price and size data for each specific limit order
event OrderFilled(
    bytes32 indexed orderHash,
    address indexed maker,
    address indexed taker,
    uint256 makerAssetId,
    uint256 takerAssetId,
    uint256 makerAmountFilled,
    uint256 takerAmountFilled,
    uint256 fee
);
*/

export function handleFill(event: OrderFilled): void {
  let maker = event.params.maker.toHexString();
  let taker = event.params.taker.toHexString();
  let makerAssetId = event.params.makerAssetId;
  let takerAssetId = event.params.takerAssetId;
  let timestamp = event.block.timestamp;

  let side = getOrderSide(makerAssetId);
  let size = getOrderSize(event, side);

  let collateralScaleDec = new BigDecimal(BigInt.fromI32(10).pow(<u8>6));

  let tokenId = '';
  if (side === TRADE_TYPE_LIMIT_BUY) {
    tokenId = takerAssetId.toHexString();
  } else {
    tokenId = makerAssetId.toHexString();
  }

  // record event
  recordOrderFilledEvent(event);

  // Enrich and store the OrderFilled event
  let orderId = enrichOrder(event, side, tokenId);

  // order book
  let orderBook: Orderbook = requireOrderBook(tokenId as string);

  updateVolumes(
    orderBook as Orderbook,
    timestamp,
    size,
    collateralScaleDec,
    side,
  );

  updateUserVolume(taker, size, collateralScaleDec, timestamp);
  markAccountAsSeen(taker, timestamp);

  updateUserVolume(maker, size, collateralScaleDec, timestamp);
  markAccountAsSeen(maker, timestamp);

  updateTradesQuantity(orderBook, side, orderId);

  // persist order book
  orderBook.save();
}

function recordOrdersMatchedEvent(event: OrdersMatched): string {
  let evt = new OrdersMatchedEvent(event.transaction.hash.toHexString());

  evt.timestamp = event.block.timestamp;
  evt.makerAssetID = event.params.takerAssetId;
  evt.takerAssetID = event.params.makerAssetId;
  evt.makerAmountFilled = event.params.takerAmountFilled;
  evt.takerAmountFilled = event.params.makerAmountFilled;

  evt.save();

  return evt.id;
}

/**
event OrdersMatched(
    bytes32 indexed takerOrderHash,
    address indexed takerOrderMaker,
    uint256 makerAssetId,
    uint256 takerAssetId,
    uint256 makerAmountFilled,
    uint256 takerAmountFilled
);
*/
export function handleMatch(event: OrdersMatched): void {
  let makerAmountFilled = event.params.takerAmountFilled;
  let takerAmountFilled = event.params.makerAmountFilled;

  let side = getOrderSide(event.params.makerAssetId);

  let size = bigZero.toBigDecimal();

  if (side === TRADE_TYPE_LIMIT_BUY) {
    size = makerAmountFilled.toBigDecimal();
  } else {
    size = takerAmountFilled.toBigDecimal();
  }

  const collateralScaleDec = new BigDecimal(BigInt.fromI32(10).pow(<u8>6));

  // record event
  recordOrdersMatchedEvent(event);

  updateGlobalVolume(size, collateralScaleDec, side);
}

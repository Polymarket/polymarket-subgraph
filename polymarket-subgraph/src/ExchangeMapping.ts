import { BigDecimal, BigInt } from '@graphprotocol/graph-ts';
import {
  OrderFilled,
  OrdersMatched,
  TokenRegistered,
} from './types/Exchange/Exchange';
import {
  EnrichedOrderFilled,
  MarketData,
  Orderbook,
  OrderFilledEvent,
  OrdersMatchedEvent,
} from './types/schema';
import { markAccountAsSeen, updateUserVolume } from './utils/account-utils';
import { TRADE_TYPE_BUY } from './utils/constants';
import { updateMarketPositionFromOrderFilled } from './utils/market-positions-utils';
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
): EnrichedOrderFilled {
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
  enriched.size = getOrderSize(
    event.params.makerAmountFilled,
    event.params.takerAmountFilled,
    side,
  );
  enriched.price = getOrderPrice(
    event.params.makerAmountFilled,
    event.params.takerAmountFilled,
    side,
  );

  enriched.save();

  return enriched;
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
  orderFilledEvent.makerAssetId = event.params.makerAssetId.toString();
  orderFilledEvent.takerAssetId = event.params.takerAssetId.toString();
  orderFilledEvent.makerAmountFilled = event.params.makerAmountFilled;
  orderFilledEvent.takerAmountFilled = event.params.takerAmountFilled;
  orderFilledEvent.fee = event.params.fee;
  orderFilledEvent.save();

  return eventId;
}

/**
 * Handles individual OrderFilled events
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
 * @param event 
 */
export function handleFill(event: OrderFilled): void {
  let maker = event.params.maker.toHexString();
  let taker = event.params.taker.toHexString();
  let makerAssetId = event.params.makerAssetId;
  let takerAssetId = event.params.takerAssetId;
  let timestamp = event.block.timestamp;

  let side = getOrderSide(makerAssetId);
  let size = getOrderSize(
    event.params.makerAmountFilled,
    event.params.takerAmountFilled,
    side,
  );

  let collateralScaleDec = new BigDecimal(BigInt.fromI32(10).pow(<u8>6));

  let tokenId = '';
  if (side === TRADE_TYPE_BUY) {
    tokenId = takerAssetId.toString();
  } else {
    tokenId = makerAssetId.toString();
  }

  // record event
  recordOrderFilledEvent(event);

  // Enrich and store the OrderFilled event
  let enriched = enrichOrder(event, side, tokenId);

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

  updateTradesQuantity(orderBook, side);

  // Update market data with most recent orderbook price
  let marketData = MarketData.load(tokenId);
  if (marketData != null) {
    marketData.priceOrderbook = enriched.price;
    marketData.save();
  }

  // Update market position
  updateMarketPositionFromOrderFilled(maker, tokenId, side, event);

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
* Handles the OrdersMatched event
event OrdersMatched(
    bytes32 indexed takerOrderHash,
    address indexed takerOrderMaker,
    uint256 makerAssetId,
    uint256 takerAssetId,
    uint256 makerAmountFilled,
    uint256 takerAmountFilled
);
 * @param event 
 */
export function handleMatch(event: OrdersMatched): void {
  let makerAmountFilled = event.params.takerAmountFilled;
  let takerAmountFilled = event.params.makerAmountFilled;

  const side = getOrderSide(event.params.makerAssetId);

  const size = getOrderSize(makerAmountFilled, takerAmountFilled, side);
  const collateralScaleDec = new BigDecimal(BigInt.fromI32(10).pow(<u8>6));

  // record event
  recordOrdersMatchedEvent(event);

  // update global volume
  updateGlobalVolume(size.toBigDecimal(), collateralScaleDec, side);
}

export function handleTokenRegistered(event: TokenRegistered): void {
  // Create MarketData entity on token registration if it hasn't been created
  // e.g if the tokens aren't associated with an FPMM
  let token0Str = event.params.token0.toString();
  let token1Str = event.params.token1.toString();
  let condition = event.params.conditionId.toHexString();

  let data0 = MarketData.load(token0Str);
  if (data0 == null) {
    data0 = new MarketData(token0Str);
    data0.condition = condition;
    data0.save();
  }

  let data1 = MarketData.load(token1Str);
  if (data1 == null) {
    data1 = new MarketData(token1Str);
    data1.condition = condition;
    data1.save();
  }
}

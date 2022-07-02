import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { OrderFilled } from "./types/LimitOrderProtocol/LimitOrderProtocol";
import { FilledOrder, FilledOrderBook, OrderFilledEvent } from "./types/schema";
import { markAccountAsSeen, updateUserVolume } from "./utils/account-utils";
import { TRADE_TYPE_LIMIT_BUY } from "./utils/constants";
import { getOrderPrice, getOrderSide, getOrderSize, requireOrderBook, updateTradesQuantity, updateVolumes } from "./utils/order-book-utils";

/*
event OrderFilled(
    bytes32 indexed orderHash,
    address indexed maker,
    address indexed taker,
    address makerAsset,
    uint256 makerAssetID,
    address takerAsset,
    uint256 takerAssetID,
    uint256 makerAmountFilled, 
    uint256 takerAmountFilled,
    uint256 remainingAmount
);
*/

/*
OrderFilled - used to calculate side, price and size data for each specific limit order
*/

function recordTx(event: OrderFilled, side: string, marketId:string): string {
  let eventId = event.transaction.hash.toHexString() + "_" + event.params.orderHash.toHexString()

  let tx = new FilledOrder(eventId);
  tx.transactionHash = event.transaction.hash
  tx.timestamp = event.block.timestamp
  tx.maker = event.params.maker.toHexString()
  tx.taker = event.params.taker.toHexString()
  tx.orderHash = event.params.orderHash
  tx.market = marketId
  tx.side = side
  tx.size = getOrderSize(event, side)
  tx.price = getOrderPrice(
    event.params.makerAmountFilled,
    event.params.takerAmountFilled,
    event.params.makerAsset,
    event.params.takerAsset,
    side,
  )

  tx.save();

  return eventId
}

function recordEvent(event: OrderFilled):string {
  let eventId = event.transaction.hash.toHexString() + "_" + event.params.orderHash.toHexString()

  let orderFilledEvent = new OrderFilledEvent(eventId);
  orderFilledEvent.transactionHash = event.transaction.hash
  orderFilledEvent.timestamp = event.block.timestamp,
  orderFilledEvent.orderHash = event.params.orderHash
  orderFilledEvent.maker = event.params.maker.toHexString()
  orderFilledEvent.taker = event.params.taker.toHexString()
  orderFilledEvent.makerAsset = event.params.makerAsset
  orderFilledEvent.takerAsset = event.params.takerAsset
  orderFilledEvent.makerAssetID = event.params.makerAssetID
  orderFilledEvent.takerAssetID = event.params.takerAssetID
  orderFilledEvent.makerAmountFilled = event.params.makerAmountFilled
  orderFilledEvent.takerAmountFilled = event.params.takerAmountFilled
  orderFilledEvent.remainingAmount = event.params.remainingAmount
  orderFilledEvent.save()

  return eventId
}

export function handleOrderFilled(event:OrderFilled):void {
  let maker = event.params.maker.toHexString()
  let taker = event.params.taker.toHexString()
  let makerAsset = event.params.makerAsset
  let makerAssetID = event.params.makerAssetID
  let takerAsset = event.params.takerAsset
  let takerAssetID = event.params.takerAssetID
  let timestamp = event.block.timestamp

  let side = getOrderSide(makerAsset)
  let size = getOrderSize(event, side)
  
  let collateralScaleDec = new BigDecimal(BigInt.fromI32(10).pow(<u8>6))

  let tokenId = ''
  if (side === TRADE_TYPE_LIMIT_BUY) {
    tokenId = takerAssetID.toHexString()
  } else {
    tokenId = makerAssetID.toHexString()
  }


  // record event
  recordEvent(event)

  // record transaction
  let orderId = recordTx(event, side, tokenId);

  // order book
  let orderBook = requireOrderBook(tokenId as string)

  updateVolumes(
    orderBook as FilledOrderBook,
    timestamp,
    size,
    collateralScaleDec,
    side,
  );

  updateUserVolume(
    taker,
    size,
    collateralScaleDec,
    timestamp,
  );
  markAccountAsSeen(taker, timestamp);

  updateUserVolume(
    maker,
    size,
    collateralScaleDec,
    timestamp,
  );
  markAccountAsSeen(maker, timestamp);

  updateTradesQuantity(
    orderBook as FilledOrderBook,
    side,
    orderId
  )

  // persist order book
  orderBook.save();
}
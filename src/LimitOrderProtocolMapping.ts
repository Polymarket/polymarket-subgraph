import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { OrderFilled } from "./types/LimitOrderProtocol/LimitOrderProtocol";
import { FilledOrder, FilledOrderBook, OrderFilledEvent } from "./types/schema";
import { markAccountAsSeen, updateUserVolume } from "./utils/account-utils";
import { getCollateralScale } from "./utils/collateralTokens";
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
  let tx = new FilledOrder(event.transaction.hash.toHexString());
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

  return event.transaction.hash.toHexString()
}

function recordEvent(event: OrderFilled):string {
  const orderFilledEvent = new OrderFilledEvent(event.transaction.hash.toHexString())
  orderFilledEvent.timestamp = event.block.timestamp,
  orderFilledEvent.orderHash =  event.params.orderHash
  orderFilledEvent.maker =  event.params.maker.toHexString()
  orderFilledEvent.taker =  event.params.taker.toHexString()
  orderFilledEvent.makerAsset =  event.params.makerAsset
  orderFilledEvent.takerAsset =  event.params.takerAsset
  orderFilledEvent.makerAssetID =  event.params.makerAssetID
  orderFilledEvent.takerAssetID =  event.params.takerAssetID
  orderFilledEvent.makerAmountFilled = event.params.makerAmountFilled
  orderFilledEvent.takerAmountFilled = event.params.takerAmountFilled
  orderFilledEvent.remainingAmount = event.params.remainingAmount
  orderFilledEvent.save()

  return event.transaction.hash.toHexString()
}

export function handleOrderFilled(event:OrderFilled):void {
  const maker = event.params.maker.toHexString()
  const taker = event.params.taker.toHexString()
  const makerAsset = event.params.makerAsset
  const makerAssetID = event.params.makerAssetID
  const takerAsset = event.params.takerAsset
  const takerAssetID = event.params.takerAssetID

  const side = getOrderSide(makerAsset)

  let tokenId = ''
  let collateralAddress = ''

  // buy
  if (side === TRADE_TYPE_LIMIT_BUY) {
    collateralAddress = makerAsset.toHexString()
    tokenId = takerAssetID.toHexString()
  } else {
    collateralAddress = takerAsset.toHexString()
    tokenId = makerAssetID.toHexString()
  }


  const collateralScaleDec = new BigDecimal(BigInt.fromI32(10).pow(<u8>6))

  const timestamp = event.block.timestamp
  const size = getOrderSize(event, side)

  // record event
  recordEvent(event)

  // record transaction
  const orderId = recordTx(event, side, tokenId);

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
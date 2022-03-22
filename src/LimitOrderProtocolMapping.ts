import { OrderFilled } from "./types/LimitOrderProtocol/LimitOrderProtocol";
import { FilledOrder, FilledOrderBook, OrderFilledEvent } from "./types/schema";
import { getCollateralScale } from "./utils/collateralTokens";
import { ERC20AssetId, TRADE_TYPE_LIMIT_BUY, TRADE_TYPE_LIMIT_SELL } from "./utils/constants";
import { increment } from "./utils/maths";
import { getOrderPrice, getOrderSize, requireOrderBook, updateVolumes } from "./utils/order-book-utils";

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
  tx.price = getOrderPrice(event, side)

  tx.save();

  return tx.id
}

function recordEvent(event: OrderFilled):string {
  const orderFilledEvent = new OrderFilledEvent(event.transaction.hash.toHexString())
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

  return orderFilledEvent.id
}

export function handleOrderFilled(event:OrderFilled):void {
  const makerAsset=event.params.makerAsset
  const makerAssetID=event.params.makerAssetID
  const takerAsset=event.params.takerAsset
  const takerAssetID=event.params.takerAssetID

  let side = ''
  let tokenId = ''
  let collateralAddress = ''

  // buy
  if (makerAssetID.toString() === ERC20AssetId) {
    side = TRADE_TYPE_LIMIT_BUY
    collateralAddress = makerAsset.toHexString()
    tokenId = takerAssetID.toHexString()
  } else {
    side = TRADE_TYPE_LIMIT_SELL
    collateralAddress = takerAsset.toHexString()
    tokenId = makerAssetID.toHexString()
  }

  const collateralScaleDec = getCollateralScale(collateralAddress).toBigDecimal();
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

  orderBook.tradesQuantity = increment(orderBook.tradesQuantity);

  if (side === TRADE_TYPE_LIMIT_BUY) {
    orderBook.buysQuantity = increment(orderBook.buysQuantity);
    orderBook.buys.push(orderId) 
  } else {
    orderBook.sellsQuantity = increment(orderBook.sellsQuantity);
    orderBook.sells.push(orderId) 
  }

  // persist order book
  orderBook.save();
}
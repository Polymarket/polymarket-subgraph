import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
// TODO(REC): replace this for the real event signature
// import { FilledOrder } from "./types/OrderExecutorV2/OrderExecutorV2"; 
import { FilledOrderEvent, FilledOrder as FilledOrderTransaction, FilledOrderBook } from "./types/schema";
import { markAccountAsSeen, updateUserVolume } from './utils/account-utils';
import { getCollateralScale } from './utils/collateralTokens';
import { bigZero, ERC20AssetId, TRADE_TYPE_LIMIT_BUY, TRADE_TYPE_LIMIT_SELL } from './utils/constants';
import { increment } from './utils/maths';
import { requireOrderBook, updateFeeFields, updateGlobalVolume, updateVolumes } from './utils/order-book-utils';


/*
event FilledOrders(
  address taker, // the person that placed the market order
  address makerAsset, // the asset that the taker is giving away(for buy, it's the collateral, for sell it's the conditional)
  address takerAsset, // see above
  uint256 makerAssetID, // the token id  bought or sold by the taker. If buy, this will be 0. if sell, this will be the token id
  uint256 takerAssetID, // see above
  uint256 makerAmountFilled, // the amount of maker assset filled
  uint256 takerAmountFilled  // the amount of taker assset filled
);
*/
// TODO(REC): replace this for the real event signature
class FilledOrder extends ethereum.Event {
  get params(): FilledOrder__Params {
    return new FilledOrder__Params(this);
  }
}

class FilledOrder__Params {
  _event: FilledOrder;

  constructor(event: FilledOrder) {
    this._event = event;
  }

  get taker(): Address {
    return this._event.parameters[0].value.toAddress();
  }

  get makerAsset(): Address {
    return this._event.parameters[1].value.toAddress();
  }

  get takerAsset(): Address {
    return this._event.parameters[2].value.toAddress();
  }

  get makerAssetID(): Bytes {
    return this._event.parameters[3].value.toBytes();
  }

  get takerAssetID(): Bytes {
    return this._event.parameters[4].value.toBytes();
  }

  get makerAmountFilled(): BigInt {
    return this._event.parameters[5].value.toBigInt();
  }

  get takerAmountFilled(): BigInt {
    return this._event.parameters[6].value.toBigInt();
  }
}

// TODO(REC): Move this to src/utils/order-book-utils.ts once FilledOrder is created
export function getOrderPrice(order: FilledOrder, side: string): BigInt {
  const price = bigZero

  const quoteAssetAmount = bigZero
  const baseAssetAmount = bigZero

  const makerAmount = order.params.makerAmountFilled
  const takerAmount = order.params.takerAmountFilled

  if (side == TRADE_TYPE_LIMIT_BUY) {
    quoteAssetAmount.plus(makerAmount)
    baseAssetAmount.plus(takerAmount)
  } else {
    quoteAssetAmount.plus(takerAmount)
    baseAssetAmount.plus(makerAmount)
  }

  price.plus(quoteAssetAmount.div(baseAssetAmount))

  return price
}

function recordTx(event: FilledOrder, side: string, eventId:string, marketId:string, size:BigInt): string {
  let tx = new FilledOrderTransaction(event.transaction.hash.toHexString());
  tx.side = side
  tx.timestamp = event.block.timestamp
  tx.event = eventId
  tx.market = marketId
  tx.user = event.params.taker.toHexString()
  tx.size = size
  tx.price = getOrderPrice(event, side)

  tx.save();

  return tx.id
}

function recordEvent(event: FilledOrder):string {
  const filledOrderEvent = new FilledOrderEvent(event.transaction.hash.toHexString())
  filledOrderEvent.timestamp = event.block.timestamp,
  filledOrderEvent.taker =  event.params.taker.toHexString()
  filledOrderEvent.makerAsset =  event.params.makerAsset
  filledOrderEvent.takerAsset =  event.params.takerAsset
  filledOrderEvent.makerAssetID =  event.params.makerAssetID
  filledOrderEvent.takerAssetID =  event.params.takerAssetID
  filledOrderEvent.makerAmountFilled = event.params.makerAmountFilled
  filledOrderEvent.takerAmountFilled = event.params.takerAmountFilled
  filledOrderEvent.save()

  return filledOrderEvent.id
}

export function handleFilled (event:FilledOrder):void {
  const taker = event.params.taker
  const makerAsset = event.params.makerAsset
  const takerAsset = event.params.takerAsset
  const makerAssetID = event.params.makerAssetID
  const takerAssetID = event.params.takerAssetID
  const makerAmountFilled = event.params.makerAmountFilled
  const takerAmountFilled = event.params.takerAmountFilled

  let side = ''
  let tokenId = ''
  let collateralAddress = ''

  // buy
  if (makerAssetID.toString() === ERC20AssetId) {
    side = TRADE_TYPE_LIMIT_BUY
    tokenId = takerAssetID.toHexString()
    collateralAddress = makerAsset.toHexString()
  } else {
    side = TRADE_TYPE_LIMIT_SELL
    tokenId = makerAssetID.toHexString()
    collateralAddress = takerAsset.toHexString()
  }

  const collateralScaleDec = getCollateralScale(collateralAddress).toBigDecimal();

  const size = side == TRADE_TYPE_LIMIT_BUY ? makerAmountFilled : takerAmountFilled
  const feeAmount = bigZero // TODO(REC): not available yet
  const timestamp = event.block.timestamp

  const accountAddress = taker.toHexString()

  // record event
  const eventId = recordEvent(event)

  // record transaction
  const orderId = recordTx(event, side, eventId, tokenId, size);

  // order book
  let orderBook = requireOrderBook(tokenId as string)

  updateVolumes(
    orderBook as FilledOrderBook,
    timestamp,
    size,
    collateralScaleDec,
    side,
  );

  updateFeeFields(
    orderBook as FilledOrderBook,
    feeAmount,
    collateralScaleDec,
  );

  updateUserVolume(
    accountAddress,
    size,
    collateralScaleDec,
    timestamp,
  );

  markAccountAsSeen(accountAddress, timestamp);

  updateGlobalVolume(
    size,
    feeAmount,
    collateralScaleDec,
    side,
  );

  orderBook.tradesQuantity = increment(orderBook.tradesQuantity);
  if (side === TRADE_TYPE_LIMIT_BUY) {
    orderBook.buysQuantity = increment(orderBook.buysQuantity);
    
    if (!orderBook.buys) {
      orderBook.buys = [] as string[]
    }
    orderBook.buys.push(orderId) 
  } else {
    orderBook.sellsQuantity = increment(orderBook.sellsQuantity);
    
    if (!orderBook.sells) {
      orderBook.sells = [] as string[]
    }
    orderBook.sells.push(orderId) 
  }

  // persist order book
  orderBook.save();
}
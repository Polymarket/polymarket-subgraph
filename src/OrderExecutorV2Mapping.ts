import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { FilledOrders } from "./types/OrderExecutorV2/OrderExecutorV2"; 
import { FilledOrdersEvent } from "./types/schema";
import { bigZero, TRADE_TYPE_LIMIT_BUY } from './utils/constants';
import { getOrderPrice, getOrderSide, updateGlobalVolume } from './utils/order-book-utils';

/*
event FilledOrders(
    address taker,
    address makerAsset,
    address takerAsset,
    uint256 makerAssetID,
    uint256 takerAssetID,
    uint256 makerAmountFilled, 
    uint256 takerAmountFilled
);
*/

/*
FilledOrders - Will be used to calculate global volume
*/

function recordEvent(event: FilledOrders): string {
  let filledOrderEvent = new FilledOrdersEvent(event.transaction.hash.toHexString())
  filledOrderEvent.timestamp = event.block.timestamp,
  filledOrderEvent.taker =  event.params.taker.toHexString()
  // swapping maker/taker: https://github.com/Polymarket/polymarket-subgraph/pull/16#issuecomment-1077927805
  filledOrderEvent.makerAsset =  event.params.takerAsset
  filledOrderEvent.takerAsset =  event.params.makerAsset
  filledOrderEvent.makerAssetID =  event.params.takerAssetID
  filledOrderEvent.takerAssetID =  event.params.makerAssetID
  filledOrderEvent.makerAmountFilled = event.params.takerAmountFilled
  filledOrderEvent.takerAmountFilled = event.params.makerAmountFilled
  filledOrderEvent.fee = event.params.fee

  filledOrderEvent.save()

  return filledOrderEvent.id
}

export function handleFilledOrders (event:FilledOrders):void {
  // swapping maker/taker: https://github.com/Polymarket/polymarket-subgraph/pull/16#issuecomment-1077927805
  let makerAsset = event.params.takerAsset
  let takerAsset = event.params.makerAsset
  let makerAmountFilled = event.params.takerAmountFilled
  let takerAmountFilled = event.params.makerAmountFilled

  let side = getOrderSide(makerAsset)

  let collateralAddress = ''
  let size = bigZero.toBigDecimal()

  // buy
  if (side === TRADE_TYPE_LIMIT_BUY) {
    collateralAddress = makerAsset.toHexString()
    size = makerAmountFilled.toBigDecimal()
  } else {
    collateralAddress = takerAsset.toHexString()
    size = takerAmountFilled.toBigDecimal()
  }

  let collateralScaleDec = new BigDecimal(BigInt.fromI32(10).pow(<u8>6))
  let price = getOrderPrice(
    takerAmountFilled,
    makerAmountFilled,
    takerAsset,
    makerAsset,
    side,
  )

  size = size.times(price)

  // record event
  recordEvent(event)

  updateGlobalVolume(
    size,
    collateralScaleDec,
    side,
  );
}
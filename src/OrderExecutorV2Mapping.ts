import { FilledOrders } from "./types/OrderExecutorV2/OrderExecutorV2"; 
import { FilledOrdersEvent } from "./types/schema";
import { getCollateralScale } from './utils/collateralTokens';
import { bigZero, TRADE_TYPE_LIMIT_BUY } from './utils/constants';
import { getOrderSide, updateGlobalVolume } from './utils/order-book-utils';

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
  const filledOrderEvent = new FilledOrdersEvent(event.transaction.hash.toHexString())
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

export function handleFilledOrders (event:FilledOrders):void {
  const makerAsset = event.params.makerAsset
  const takerAsset = event.params.takerAsset
  const makerAmountFilled = event.params.makerAmountFilled
  const takerAmountFilled = event.params.takerAmountFilled

  const side = getOrderSide(makerAsset)

  let collateralAddress = ''
  let size = bigZero

  // buy
  if (side === TRADE_TYPE_LIMIT_BUY) {
    collateralAddress = makerAsset.toHexString()
    size = makerAmountFilled
  } else {
    collateralAddress = takerAsset.toHexString()
    size = takerAmountFilled
  }

  const collateralScaleDec = getCollateralScale(collateralAddress).toBigDecimal();

  // record event
  recordEvent(event)

  updateGlobalVolume(
    size,
    collateralScaleDec,
    side,
  );
}
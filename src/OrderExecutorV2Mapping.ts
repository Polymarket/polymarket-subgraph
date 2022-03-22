import { FilledOrders } from "./types/OrderExecutorV2/OrderExecutorV2"; 
import { FilledOrdersEvent } from "./types/schema";
import { markAccountAsSeen, updateUserVolume } from './utils/account-utils';
import { getCollateralScale } from './utils/collateralTokens';
import { bigZero, ERC20AssetId, TRADE_TYPE_LIMIT_BUY, TRADE_TYPE_LIMIT_SELL } from './utils/constants';
import { updateGlobalVolume } from './utils/order-book-utils';

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

function recordEvent(event: FilledOrders):string {
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
  const taker = event.params.taker
  const makerAsset = event.params.makerAsset
  const takerAsset = event.params.takerAsset
  const makerAssetID = event.params.makerAssetID
  const makerAmountFilled = event.params.makerAmountFilled
  const takerAmountFilled = event.params.takerAmountFilled

  let side = ''
  let collateralAddress = ''
  let size = bigZero

  // buy
  if (makerAssetID.toString() === ERC20AssetId) {
    side = TRADE_TYPE_LIMIT_BUY
    collateralAddress = makerAsset.toHexString()
    size.plus(makerAmountFilled)
  } else {
    side = TRADE_TYPE_LIMIT_SELL
    collateralAddress = takerAsset.toHexString()
    size.plus(takerAmountFilled)
  }

  const collateralScaleDec = getCollateralScale(collateralAddress).toBigDecimal();
  const timestamp = event.block.timestamp
  const accountAddress = taker.toHexString()

  // record event
  recordEvent(event)

  updateUserVolume(
    accountAddress,
    size,
    collateralScaleDec,
    timestamp,
  );

  markAccountAsSeen(accountAddress, timestamp);

  updateGlobalVolume(
    size,
    collateralScaleDec,
    side,
  );
}
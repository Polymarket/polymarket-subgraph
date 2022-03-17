import { BigInt, ByteArray, log } from '@graphprotocol/graph-ts';
import { Filled } from "./types/OrderExecutorV2/OrderExecutorV2";
import { FixedProductMarketMaker, Transaction, FilledOrder } from "./types/schema";
import { markAccountAsSeen, updateUserVolume } from './utils/account-utils';
import { getCollateralScale } from './utils/collateralTokens';
import { bigZero, TRADE_TYPE_BUY, TRADE_TYPE_SELL } from './utils/constants';
import { updateFeeFields, updateVolumes } from './utils/fpmm-utils';
import { updateGlobalVolume } from './utils/global-utils';
import { increment } from './utils/maths';


function recordBuy(event: Filled, tradeAmount:BigInt, feeAmount:BigInt): void {
  let buy = new Transaction(event.transaction.hash.toHexString());
  buy.type = TRADE_TYPE_BUY;
  buy.timestamp = event.block.timestamp;
  buy.market = event.address.toHexString();
  buy.user = event.params.maker.toHexString();
  buy.tradeAmount = tradeAmount;
  buy.feeAmount = feeAmount;
  buy.save();
}

function recordSell(event: Filled, tradeAmount:BigInt, feeAmount:BigInt): void {
  let sell = new Transaction(event.transaction.hash.toHexString());
  sell.type = TRADE_TYPE_SELL;
  sell.timestamp = event.block.timestamp;
  sell.market = event.address.toHexString();
  sell.user = event.params.maker.toHexString();
  sell.tradeAmount = tradeAmount;
  sell.feeAmount = feeAmount;
  sell.save();
}

export function handleFilled (event:Filled):void {
  const fpmmAddress = event.address.toHexString();
  const fpmm = FixedProductMarketMaker.load(fpmmAddress);
  if (!fpmm) {
    log.error('cannot fill order: FixedProductMarketMaker instance for {} not found', [
      fpmmAddress,
    ]);
    return;
  }

  const timestamp = event.block.timestamp
  const collateralScaleDec = getCollateralScale(fpmm.collateralToken).toBigDecimal();
  const accountAddress = event.params.maker.toHexString()
  const tradeSize = bigZero
  const feeAmount = bigZero
  let tradeType = ''

  if (event.params.makerAsset.equals(ByteArray.fromHexString(fpmm.collateralToken))) {
    tradeSize.plus(event.params.makerAmountFilled)
    tradeType = TRADE_TYPE_BUY
  } else {
    tradeSize.plus(event.params.takerAmountFilled)
    tradeType = TRADE_TYPE_SELL
  }

  const filledOrder = new FilledOrder(event.transaction.hash.toHexString())
  filledOrder.timestamp = timestamp,
  filledOrder.maker =  event.params.maker.toHexString()
  filledOrder.makerAsset =  event.params.makerAsset.toHexString()
  filledOrder.takerAsset =  event.params.takerAsset.toHexString()
  filledOrder.makerAmountFilled = event.params.makerAmountFilled
  filledOrder.takerAmountFilled = event.params.takerAmountFilled
  filledOrder.save()

  updateVolumes(
    fpmm as FixedProductMarketMaker,
    timestamp,
    tradeSize,
    collateralScaleDec,
    tradeType,
  );

  updateFeeFields(
    fpmm as FixedProductMarketMaker,
    feeAmount,
    collateralScaleDec,
  );

  updateUserVolume(
    accountAddress,
    tradeSize,
    collateralScaleDec,
    timestamp,
  );

  markAccountAsSeen(accountAddress, timestamp);

  updateGlobalVolume(
    tradeSize,
    feeAmount,
    collateralScaleDec,
    tradeType,
  );

  if (tradeType === TRADE_TYPE_BUY) {
    recordBuy(event, tradeSize, feeAmount);  
    fpmm.buysQuantity = increment(fpmm.buysQuantity); 
  } else {
    recordSell(event, tradeSize, feeAmount);    
    fpmm.sellsQuantity = increment(fpmm.sellsQuantity);
  }

  fpmm.tradesQuantity = increment(fpmm.tradesQuantity);
  fpmm.save();
}
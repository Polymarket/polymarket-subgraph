import { log } from '@graphprotocol/graph-ts';
import { OrderFilled } from "./types/LimitOrderProtocol/LimitOrderProtocol";
import { FixedProductMarketMaker, OrderFilled as SchemaOrderFilled } from "./types/schema";
import { markAccountAsSeen } from './utils/account-utils';
import { getCollateralScale } from './utils/collateralTokens';
import { bigZero } from './utils/constants';
import { updateFeeFields } from './utils/fpmm-utils';
import { increment } from './utils/maths';

export function handleOrderFilled (event:OrderFilled):void {
  const fpmmAddress = event.address.toHexString();
  const fpmm = FixedProductMarketMaker.load(fpmmAddress);
  if (fpmm == null) {
    log.error('cannot fill order: FixedProductMarketMaker instance for {} not found', [
      fpmmAddress,
    ]);
    return;
  }

  const timestamp = event.block.timestamp
  const collateralScaleDec = getCollateralScale(fpmm.collateralToken).toBigDecimal();
  const accountAddress = event.params.maker.toHexString()
  const feeAmount = bigZero

  const orderFilled = new SchemaOrderFilled(event.transaction.hash.toHexString())
  orderFilled.timestamp = timestamp,
  orderFilled.address =  accountAddress
  orderFilled.orderHash =  event.params.orderHash
  orderFilled.remaining =  event.params.remaining
  orderFilled.save()
  
  updateFeeFields(
    fpmm,
    feeAmount,
    collateralScaleDec,
  );
    
  markAccountAsSeen(accountAddress, timestamp);

  fpmm.tradesQuantity = increment(fpmm.tradesQuantity);
  fpmm.save();
}
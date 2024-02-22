/* eslint-disable @typescript-eslint/ban-types */

import { Address, BigInt } from '@graphprotocol/graph-ts';

import { OrderFilled } from '../types/Exchange/Exchange';

import { TradeType } from '../../../common/constants';

class Order {
  account: Address;

  side: TradeType;

  baseAmount: BigInt;

  quoteAmount: BigInt;

  positionId: BigInt;
}

// the taker is always the exchange!
const parseOrderFilled = (event: OrderFilled): Order => {
  const side = event.params.makerAssetId.equals(BigInt.zero())
    ? TradeType.BUY
    : TradeType.SELL;

  return side == TradeType.BUY
    ? {
        account: event.params.maker,
        side: TradeType.BUY,
        baseAmount: event.params.takerAmountFilled,
        quoteAmount: event.params.makerAmountFilled,
        positionId: event.params.takerAssetId,
      }
    : {
        account: event.params.maker,
        side: TradeType.SELL,
        baseAmount: event.params.makerAmountFilled,
        quoteAmount: event.params.takerAmountFilled,
        positionId: event.params.makerAssetId,
      };
};

export { parseOrderFilled, Order };

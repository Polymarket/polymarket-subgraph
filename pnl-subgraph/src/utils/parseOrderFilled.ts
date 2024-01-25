/* eslint-disable @typescript-eslint/ban-types */

import { Address, BigInt } from '@graphprotocol/graph-ts';

import { OrderFilled } from '../types/Exchange/Exchange';

import { TRADE_TYPE_BUY, TRADE_TYPE_SELL } from '../../../common/constants';

class Order {
  buyer: Address;

  seller: Address;

  baseAmount: BigInt;

  quoteAmount: BigInt;

  positionId: BigInt;
}

const parseOrderFilled = (event: OrderFilled): Order => {
  const side = event.params.makerAssetId.equals(BigInt.zero())
    ? TRADE_TYPE_BUY
    : TRADE_TYPE_SELL;

  return side === TRADE_TYPE_BUY
    ? {
        buyer: event.params.maker,
        seller: event.params.taker,
        baseAmount: event.params.takerAmountFilled,
        quoteAmount: event.params.makerAmountFilled,
        positionId: event.params.takerAssetId,
      }
    : {
        buyer: event.params.taker,
        seller: event.params.maker,
        baseAmount: event.params.makerAmountFilled,
        quoteAmount: event.params.takerAmountFilled,
        positionId: event.params.makerAssetId,
      };
};

export { parseOrderFilled, Order };

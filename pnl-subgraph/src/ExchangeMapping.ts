import { BigInt } from '@graphprotocol/graph-ts';
import { OrderFilled } from './types/Exchange/Exchange';
import { COLLATERAL_SCALE, TRADE_TYPE_BUY, TRADE_TYPE_SELL } from './constants';
import { updateUserPositionWithBuy } from './utils/updateUserPositionWithBuy';
import { updateUserPositionWithSell } from './utils/updateUserPositionWithSell';

/**
 * Handles individual OrderFilled events
event OrderFilled(
    bytes32 indexed orderHash,
    address indexed maker,
    address indexed taker,
    uint256 makerAssetId,
    uint256 takerAssetId,
    uint256 makerAmountFilled,
    uint256 takerAmountFilled,
    uint256 fee
);
 * @param event 
 */
export function handleOrderFilled(event: OrderFilled): void {
  const side = event.params.makerAssetId.equals(BigInt.zero())
    ? TRADE_TYPE_BUY
    : TRADE_TYPE_SELL;
  const [buyer, seller] =
    side === TRADE_TYPE_BUY
      ? [event.params.maker, event.params.taker]
      : [event.params.taker, event.params.maker];
  const [baseAmount, quoteAmount] =
    side === TRADE_TYPE_BUY
      ? [event.params.takerAmountFilled, event.params.makerAmountFilled]
      : [event.params.makerAmountFilled, event.params.takerAmountFilled];
  const positionId =
    side === TRADE_TYPE_BUY
      ? event.params.takerAssetId
      : event.params.makerAssetId;

  // dollars per share
  const price = quoteAmount.times(COLLATERAL_SCALE).div(baseAmount);

  updateUserPositionWithBuy(buyer, positionId, price, baseAmount);
  updateUserPositionWithSell(seller, positionId, price, baseAmount);
}

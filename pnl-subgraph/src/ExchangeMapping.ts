import { OrderFilled } from './types/Exchange/Exchange';

import { parseOrderFilled } from './utils/parseOrderFilled';
import { updateUserPositionWithBuy } from './utils/updateUserPositionWithBuy';
import { updateUserPositionWithSell } from './utils/updateUserPositionWithSell';

import { COLLATERAL_SCALE } from '../../common/constants';

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
  const order = parseOrderFilled(event);

  // dollars per share
  const price = order.quoteAmount.times(COLLATERAL_SCALE).div(order.baseAmount);

  updateUserPositionWithBuy(
    order.buyer,
    order.positionId,
    price,
    order.baseAmount,
  );
  updateUserPositionWithSell(
    order.seller,
    order.positionId,
    price,
    order.baseAmount,
  );
}

import { OrderFilled } from './types/Exchange/Exchange';

import { Price } from './types/schema';
import { parseOrderFilled } from './utils/parseOrderFilled';

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

  let price = Price.load(order.positionId.toString());

  if (price == null) {
    price = new Price(order.positionId.toString());
  }

  price.p = order.quoteAmount.div(order.baseAmount).toBigDecimal();
  price.save();
}

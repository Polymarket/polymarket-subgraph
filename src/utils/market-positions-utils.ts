import { BigInt } from '@graphprotocol/graph-ts'
import { FixedProductMarketMaker, MarketPosition } from "../../generated/schema";
import { PositionsMerge } from "../../generated/ConditionalTokens/ConditionalTokens";


/*
 * Returns the user's position for the given market and outcome
 * If no such position exists then a null position is generated
 */
export function getMarketPosition(user: string, market: string, outcomeIndex: BigInt): MarketPosition {
  let positionId = user + market + outcomeIndex.toString()
  let position = MarketPosition.load(positionId);
  if (position == null) {
    position = new MarketPosition(positionId);
    position.market = market;
    position.user = user;
    position.outcomeIndex = outcomeIndex;
    position.totalQuantity = BigInt.fromI32(0);
    position.totalValue = BigInt.fromI32(0);
  }
  return position as MarketPosition
}

/*
 * Updates a user's market position after a merge

 * WARNING: This is only valid for markets which have a single condition
 * It assumes that the number of outcome slots on the market maker is equal to that on the condition
 */
export function mergePositions(marketMaker: FixedProductMarketMaker, event: PositionsMerge) {
  let userAddress = event.transaction.from.toHexString();
  let totalSlots = marketMaker.outcomeSlotCount
  for (let outcomeIndex = 0; outcomeIndex < totalSlots; outcomeIndex++) {
    let position = getMarketPosition(userAddress, marketMaker.id, BigInt.fromI32(outcomeIndex));
    // Event emits the number of outcome tokens added to the market maker
    position.totalQuantity = position.totalQuantity.minus(event.params.amount);

    // We treat it as the user selling tokens for equal values
    // TODO: weight for the prices in the market maker.
    let mergeValue = event.params.amount.div(BigInt.fromI32(totalSlots))
    position.totalValue = position.totalValue.minus(mergeValue);
    position.save();
  }
}
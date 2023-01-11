import {
  Condition,
  FixedProductMarketMaker,
  MarketData,
} from '../types/schema';
import { log } from '@graphprotocol/graph-ts';
import { getMarket } from './ctf-utils';

export function updateMarketDataFromFPMMTrade(
  fpmm: FixedProductMarketMaker,
): void {
  let conditionId = fpmm.conditions[0];
  let condition = Condition.load(conditionId);
  if (condition == null) {
    log.error('cannot find condition for conditionId', [conditionId]);
    return;
  }
  let outcomeTokenCount = condition.outcomeSlotCount;
  let collateralTokenAddress = fpmm.collateralToken;
  let conditionalTokenAddress = fpmm.conditionalTokenAddress;

  for (let outcomeIndex = 0; outcomeIndex < outcomeTokenCount; outcomeIndex++) {
    let tokenId = getMarket(
      conditionalTokenAddress,
      conditionId,
      collateralTokenAddress,
      outcomeTokenCount,
      outcomeIndex,
    );

    let marketData = MarketData.load(tokenId);
    if (marketData != null) {
      marketData.priceFPMM = fpmm.outcomeTokenPrices[outcomeIndex];
      marketData.save();
    }
  }
}

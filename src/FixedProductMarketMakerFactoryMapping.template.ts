import { BigInt, log, BigDecimal } from '@graphprotocol/graph-ts';

import { FixedProductMarketMakerCreation } from './types/FixedProductMarketMakerFactory/FixedProductMarketMakerFactory';
import { FixedProductMarketMaker, Condition, MarketData } from './types/schema';
import { FixedProductMarketMaker as FixedProductMarketMakerTemplate } from './types/templates';
import { timestampToDay } from './utils/time';
import { bigZero } from './utils/constants';
import { getCollateralDetails } from './utils/collateralTokens';
import { getMarket } from './utils/ctf-utils';

/**
 * Initialise all variables of fpmm which start at zero
 * @param fpmm A half initialised FixedProductMarketMaker
 * @returns FixedProductMarketMaker with remaining variables set
 */
function initialiseFPMM(
  fpmm: FixedProductMarketMaker,
  event: FixedProductMarketMakerCreation,
): FixedProductMarketMaker {
  /* eslint-disable no-param-reassign */

  fpmm.totalSupply = bigZero;
  let outcomeTokenAmounts = new Array<BigInt>(fpmm.outcomeSlotCount);
  let outcomeTokenPrices = new Array<BigDecimal>(fpmm.outcomeSlotCount);
  for (let i = 0; i < outcomeTokenAmounts.length; i += 1) {
    outcomeTokenAmounts[i] = bigZero;
    outcomeTokenPrices[i] = bigZero.toBigDecimal();
  }
  fpmm.outcomeTokenAmounts = outcomeTokenAmounts;
  // Market maker starts with no tokens so results in zero prices
  fpmm.outcomeTokenPrices = outcomeTokenPrices;

  fpmm.lastActiveDay = timestampToDay(event.block.timestamp);
  fpmm.collateralVolume = bigZero;
  fpmm.scaledCollateralVolume = bigZero.toBigDecimal();
  fpmm.collateralBuyVolume = bigZero;
  fpmm.scaledCollateralBuyVolume = bigZero.toBigDecimal();
  fpmm.collateralSellVolume = bigZero;
  fpmm.scaledCollateralSellVolume = bigZero.toBigDecimal();
  fpmm.liquidityParameter = bigZero;
  fpmm.scaledLiquidityParameter = bigZero.toBigDecimal();
  fpmm.feeVolume = bigZero;
  fpmm.scaledFeeVolume = bigZero.toBigDecimal();

  fpmm.tradesQuantity = bigZero;
  fpmm.buysQuantity = bigZero;
  fpmm.sellsQuantity = bigZero;
  fpmm.liquidityAddQuantity = bigZero;
  fpmm.liquidityRemoveQuantity = bigZero;

  return fpmm;
}

export function handleFixedProductMarketMakerCreation(
  event: FixedProductMarketMakerCreation,
): void {
  let address = event.params.fixedProductMarketMaker;
  let addressHexString = address.toHexString();
  let conditionalTokensAddress = event.params.conditionalTokens.toHexString();

  if (
    conditionalTokensAddress !=
    '{{lowercase contracts.ConditionalTokens.address}}'
  ) {
    log.info('cannot index market maker {}: using conditional tokens {}', [
      addressHexString,
      conditionalTokensAddress,
    ]);
    return;
  }

  let fixedProductMarketMaker = new FixedProductMarketMaker(addressHexString);
  fixedProductMarketMaker.creator = event.params.creator;
  fixedProductMarketMaker.creationTimestamp = event.block.timestamp;
  fixedProductMarketMaker.creationTransactionHash = event.transaction.hash;
  fixedProductMarketMaker.conditionalTokenAddress = conditionalTokensAddress;
  fixedProductMarketMaker.conditions = [];

  getCollateralDetails(event.params.collateralToken);
  let collateralToken = event.params.collateralToken.toHexString();
  fixedProductMarketMaker.collateralToken = collateralToken;
  fixedProductMarketMaker.fee = event.params.fee;

  let conditionIds = event.params.conditionIds;
  let outcomeTokenCount = 1;
  for (let i = 0; i < conditionIds.length; i += 1) {
    let conditionIdStr = conditionIds[i].toHexString();

    let condition = Condition.load(conditionIdStr);
    if (condition == null) {
      log.error('failed to create market maker {}: condition {} not prepared', [
        addressHexString,
        conditionIdStr,
      ]);
      return;
    }

    outcomeTokenCount *= condition.outcomeSlotCount;
    condition.fixedProductMarketMakers =
      condition.fixedProductMarketMakers.concat([addressHexString]);
    condition.save();

    fixedProductMarketMaker.conditions =
      fixedProductMarketMaker.conditions.concat([conditionIdStr]);
  }

  fixedProductMarketMaker.outcomeSlotCount = outcomeTokenCount;

  fixedProductMarketMaker = initialiseFPMM(fixedProductMarketMaker, event);
  fixedProductMarketMaker.save();

  //  Create MarketData on FPMM creation
  for (
    let outcomeIndex = 0;
    outcomeIndex < outcomeTokenCount;
    outcomeIndex += 1
  ) {
    let condition = fixedProductMarketMaker.conditions[0];

    let tokenId = getMarket(
      conditionalTokensAddress,
      condition,
      collateralToken,
      outcomeTokenCount,
      outcomeIndex,
    );
    let payouts = new Array<BigDecimal>(outcomeTokenCount);
    payouts.fill(BigDecimal.zero());

    let marketData = new MarketData(tokenId);
    marketData.conditionId = condition;
    marketData.outcomeIndex = BigInt.fromI32(outcomeIndex);
    marketData.fpmmAddress = addressHexString;
    marketData.payouts = payouts;

    marketData.save();
  }

  FixedProductMarketMakerTemplate.create(address);
}

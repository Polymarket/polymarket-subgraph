import { BigInt, log, Address, BigDecimal } from '@graphprotocol/graph-ts'

import { FixedProductMarketMakerCreation } from './types/FixedProductMarketMakerFactory/FixedProductMarketMakerFactory'
import { FixedProductMarketMaker, Condition } from './types/schema'
import { FixedProductMarketMaker as FixedProductMarketMakerTemplate } from './types/templates'
import { nthRoot } from './utils/nth-root';
import { timestampToDay, joinDayAndVolume } from './utils/day-volume-utils';
import { updateScaledVolumes, getCollateralScale, updateLiquidityFields, calculatePrices } from './utils/fpmm-utils';
import { bigZero, bigOne } from './utils/constants';

export function handleFixedProductMarketMakerCreation(event: FixedProductMarketMakerCreation): void {
  let address = event.params.fixedProductMarketMaker;
  let addressHexString = address.toHexString();
  let conditionalTokensAddress = event.params.conditionalTokens.toHexString();

  if (conditionalTokensAddress != '{{lowercase contracts.ConditionalTokens.address}}') {
    log.info(
      'cannot index market maker {}: using conditional tokens {}',
      [addressHexString, conditionalTokensAddress],
    );
    return;
  }

  let fixedProductMarketMaker = new FixedProductMarketMaker(addressHexString);

  fixedProductMarketMaker.creator = event.params.creator;
  fixedProductMarketMaker.creationTimestamp = event.block.timestamp;

  fixedProductMarketMaker.collateralToken = event.params.collateralToken;
  fixedProductMarketMaker.fee = event.params.fee;

  let conditionIds = event.params.conditionIds;
  let outcomeTokenCount = 1;
  for(let i = 0; i < conditionIds.length; i++) {
    let conditionIdStr = conditionIds[i].toHexString();

    let condition = Condition.load(conditionIdStr);
    if(condition == null) {
      log.error(
        'failed to create market maker {}: condition {} not prepared',
        [addressHexString, conditionIdStr],
      );
      return;
    }

    outcomeTokenCount *= condition.outcomeSlotCount;
    condition.fixedProductMarketMakers = condition.fixedProductMarketMakers.concat([addressHexString])
    condition.save()
  }
  fixedProductMarketMaker.outcomeSlotCount = outcomeTokenCount;

  // Initialise FPMM state
  fixedProductMarketMaker.totalSupply = bigZero;
  fixedProductMarketMaker.collateralVolume = bigZero;
  fixedProductMarketMaker.feeVolume = bigZero;


  let outcomeTokenAmounts = new Array<BigInt>(outcomeTokenCount);
  let amountsProduct = bigOne;
  for(let i = 0; i < outcomeTokenAmounts.length; i++) {
    outcomeTokenAmounts[i] = bigZero;
    amountsProduct = amountsProduct.times(outcomeTokenAmounts[i]);
  }
  fixedProductMarketMaker.outcomeTokenAmounts = outcomeTokenAmounts;
  fixedProductMarketMaker.outcomeTokenPrices = calculatePrices(outcomeTokenAmounts);
  let liquidityParameter = nthRoot(amountsProduct, outcomeTokenAmounts.length);
  let collateralScale = getCollateralScale(fixedProductMarketMaker.collateralToken as Address);
  let collateralScaleDec = collateralScale.toBigDecimal();
  updateLiquidityFields(fixedProductMarketMaker, liquidityParameter, collateralScaleDec);

  let currentDay = timestampToDay(event.block.timestamp);
  fixedProductMarketMaker.lastActiveDay = currentDay;
  fixedProductMarketMaker.runningDailyVolume = bigZero;
  fixedProductMarketMaker.lastActiveDayAndRunningDailyVolume = joinDayAndVolume(currentDay, bigZero);
  fixedProductMarketMaker.collateralVolumeBeforeLastActiveDay = bigZero;

  updateScaledVolumes(fixedProductMarketMaker, collateralScale, collateralScaleDec, currentDay);
  fixedProductMarketMaker.scaledFeeVolume = new BigDecimal(bigZero);

  fixedProductMarketMaker.save();

  FixedProductMarketMakerTemplate.create(address);
}

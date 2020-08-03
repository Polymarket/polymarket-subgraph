import { BigInt, log, Address } from '@graphprotocol/graph-ts'

import { FixedProductMarketMakerCreation } from '../generated/FixedProductMarketMakerFactory/FixedProductMarketMakerFactory'
import { FixedProductMarketMaker, Condition } from '../generated/schema'
import { FixedProductMarketMaker as FixedProductMarketMakerTemplate } from '../generated/templates'
import { nthRoot } from './utils/nth-root';
import { timestampToDay, joinDayAndVolume } from './utils/day-volume-utils';
import { updateScaledVolumes, getCollateralScale, updateLiquidityFields } from './utils/fpmm-utils';

let zeroAsBigInt = BigInt.fromI32(0);

export function handleFixedProductMarketMakerCreation(event: FixedProductMarketMakerCreation): void {
  let address = event.params.fixedProductMarketMaker;
  let addressHexString = address.toHexString();
  let conditionalTokensAddress = event.params.conditionalTokens.toHexString();

  if (conditionalTokensAddress != '{{ConditionalTokens.addressLowerCase}}') {
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
  let conditionIdStrs = new Array<string>(conditionIds.length);
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
    conditionIdStrs[i] = conditionIdStr;
  }
  fixedProductMarketMaker.conditions = conditionIdStrs;
  fixedProductMarketMaker.outcomeSlotCount = outcomeTokenCount;

  // Initialise FPMM state
  fixedProductMarketMaker.totalSupply = zeroAsBigInt;
  fixedProductMarketMaker.collateralVolume = zeroAsBigInt;

  let outcomeTokenAmounts = new Array<BigInt>(outcomeTokenCount);
  let amountsProduct = BigInt.fromI32(1);
  for(let i = 0; i < outcomeTokenAmounts.length; i++) {
    outcomeTokenAmounts[i] = zeroAsBigInt;
    amountsProduct = amountsProduct.times(outcomeTokenAmounts[i]);
  }
  fixedProductMarketMaker.outcomeTokenAmounts = outcomeTokenAmounts;
  let liquidityParameter = nthRoot(amountsProduct, outcomeTokenAmounts.length);
  let collateralScale = getCollateralScale(fixedProductMarketMaker.collateralToken as Address);
  let collateralScaleDec = collateralScale.toBigDecimal();
  updateLiquidityFields(fixedProductMarketMaker, liquidityParameter, collateralScaleDec);

  let currentDay = timestampToDay(event.block.timestamp);
  fixedProductMarketMaker.lastActiveDay = currentDay;
  fixedProductMarketMaker.runningDailyVolume = zeroAsBigInt;
  fixedProductMarketMaker.lastActiveDayAndRunningDailyVolume = joinDayAndVolume(currentDay, zeroAsBigInt);
  fixedProductMarketMaker.collateralVolumeBeforeLastActiveDay = zeroAsBigInt;

  updateScaledVolumes(fixedProductMarketMaker, collateralScale, collateralScaleDec, currentDay);

  fixedProductMarketMaker.save();

  FixedProductMarketMakerTemplate.create(address);
}

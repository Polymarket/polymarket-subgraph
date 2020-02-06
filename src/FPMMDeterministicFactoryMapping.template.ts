import { BigInt, log } from '@graphprotocol/graph-ts'

import { FixedProductMarketMakerCreation } from '../generated/FPMMDeterministicFactory/FPMMDeterministicFactory'
import { FixedProductMarketMaker, Condition } from '../generated/schema'
import { FixedProductMarketMaker as FixedProductMarketMakerTemplate } from '../generated/templates'

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

    outcomeTokenCount *= condition.outcomeSlotCount.toI32();
    conditionIdStrs[i] = conditionIdStr;
  }
  fixedProductMarketMaker.conditions = conditionIdStrs;

  fixedProductMarketMaker.collateralVolume = BigInt.fromI32(0);

  let outcomeTokenAmounts = new Array<BigInt>(outcomeTokenCount);
  for(let i = 0; i < outcomeTokenAmounts.length; i++) {
    outcomeTokenAmounts[i] = BigInt.fromI32(0);
  }
  fixedProductMarketMaker.outcomeTokenAmounts = outcomeTokenAmounts;

  fixedProductMarketMaker.save();

  FixedProductMarketMakerTemplate.create(address);
}

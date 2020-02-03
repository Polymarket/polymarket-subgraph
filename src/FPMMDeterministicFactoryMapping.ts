import { BigInt } from '@graphprotocol/graph-ts'

import { FixedProductMarketMakerCreation } from '../generated/FPMMDeterministicFactory/FPMMDeterministicFactory'
import { FixedProductMarketMaker } from '../generated/schema'
import { FixedProductMarketMaker as FixedProductMarketMakerTemplate } from '../generated/templates'

export function handleFixedProductMarketMakerCreation(event: FixedProductMarketMakerCreation): void {
  let address = event.params.fixedProductMarketMaker;
  let fixedProductMarketMaker = new FixedProductMarketMaker(address.toHexString());

  fixedProductMarketMaker.creator = event.params.creator;
  fixedProductMarketMaker.creationTimestamp = event.block.timestamp;

  fixedProductMarketMaker.conditionalTokens = event.params.conditionalTokens;
  fixedProductMarketMaker.collateralToken = event.params.collateralToken;
  fixedProductMarketMaker.fee = event.params.fee;
  fixedProductMarketMaker.volume = BigInt.fromI32(0);

  fixedProductMarketMaker.save();

  FixedProductMarketMakerTemplate.create(address);
}

import { FixedProductMarketMakerCreation } from '../generated/FPMMDeterministicFactory/FPMMDeterministicFactory'
import { FixedProductMarketMaker } from '../generated/schema'
import { FixedProductMarketMaker as FixedProductMarketMakerTemplate } from '../generated/templates'

export function handleFixedProductMarketMakerCreation(event: FixedProductMarketMakerCreation): void {
  let address = event.params.fixedProductMarketMaker;
  let fixedProductMarketMaker = new FixedProductMarketMaker(address.toHexString());
  fixedProductMarketMaker.creator = event.params.creator;
  fixedProductMarketMaker.collateralToken = event.params.collateralToken;
  fixedProductMarketMaker.save();
  FixedProductMarketMakerTemplate.create(address);
}

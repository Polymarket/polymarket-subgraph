import { FixedProductMarketMakerCreation } from './types/FixedProductMarketMakerFactory/FixedProductMarketMakerFactory';
import { FPMM } from './types/schema';
import { FixedProductMarketMaker as FixedProductMarketMakerTemplate } from './types/templates';

export function handleFixedProductMarketMakerCreation(
  event: FixedProductMarketMakerCreation,
): void {
  const fpmm = new FPMM(event.params.fixedProductMarketMaker.toHexString());
  fpmm.conditionId = event.params.conditionIds[0].toHexString();
  fpmm.save();

  FixedProductMarketMakerTemplate.create(event.params.fixedProductMarketMaker);
}

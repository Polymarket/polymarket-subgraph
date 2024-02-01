import { FixedProductMarketMakerCreation } from './types/FixedProductMarketMakerFactory/FixedProductMarketMakerFactory';
import { FixedProductMarketMaker } from './types/schema';

export function handleFixedProductMarketMakerCreation(
  event: FixedProductMarketMakerCreation,
): void {
  const fixedProductMarketMaker = new FixedProductMarketMaker(
    event.params.fixedProductMarketMaker.toHexString(),
  );
  fixedProductMarketMaker.save();
}

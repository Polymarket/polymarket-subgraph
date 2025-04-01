import { USDC } from '../../common/constants';
import { FixedProductMarketMakerCreation } from './types/FixedProductMarketMakerFactory/FixedProductMarketMakerFactory';
import { FPMM } from './types/schema';

export function handleFixedProductMarketMakerCreation(
  event: FixedProductMarketMakerCreation,
): void {
  if (event.params.collateralToken == USDC) {
    const fpmm = new FPMM(event.params.fixedProductMarketMaker.toHexString());
    fpmm.conditionId = event.params.conditionIds[0].toHexString();
    fpmm.save();
  }
}

import { log } from '@graphprotocol/graph-ts'

import { FixedProductMarketMaker } from "../generated/schema"
import {
  FPMMFundingAdded,
  FPMMFundingRemoved,
  FPMMBuy,
  FPMMSell,
} from "../generated/templates/FixedProductMarketMaker/FixedProductMarketMaker"

export function handleFundingAdded(event: FPMMFundingAdded): void {}
export function handleFundingRemoved(event: FPMMFundingRemoved): void {}

export function handleBuy(event: FPMMBuy): void {
  let fpmmAddress = event.address.toHexString()
  let fpmm = FixedProductMarketMaker.load(fpmmAddress);
  if (fpmm == null) {
    log.error('cannot buy: FixedProductMarketMaker instance for {} not found', [fpmmAddress]);
    return;
  }

  fpmm.collateralVolume = fpmm.collateralVolume.plus(event.params.investmentAmount)
  fpmm.save();
}

export function handleSell(event: FPMMSell): void {
  let fpmmAddress = event.address.toHexString()
  let fpmm = FixedProductMarketMaker.load(fpmmAddress);
  if (fpmm == null) {
    log.error('cannot sell: FixedProductMarketMaker instance for {} not found', [fpmmAddress]);
    return;
  }

  fpmm.collateralVolume = fpmm.collateralVolume.plus(event.params.returnAmount)
  fpmm.save();
}

import { FixedProductMarketMaker } from "../generated/schema"
import {
  FPMMFundingAdded,
  FPMMFundingRemoved,
  FPMMBuy,
  FPMMSell,
} from "../generated/templates/FixedProductMarketMaker/FixedProductMarketMaker"

export function handleFundingAdded(event: FPMMFundingAdded): void {}
export function handleFundingRemoved(event: FPMMFundingRemoved): void {}
export function handleBuy(event: FPMMBuy): void {}
export function handleSell(event: FPMMSell): void {}
